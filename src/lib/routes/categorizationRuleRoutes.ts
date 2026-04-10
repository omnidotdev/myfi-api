import { asc, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  categorizationRuleSplitTable,
  categorizationRuleTable,
} from "lib/db/schema";

interface SplitInput {
  accountId: string;
  side: string;
  percentage?: string;
  fixedAmount?: string;
  memo?: string;
  tagId?: string;
  sortOrder?: number;
}

type SplitValidationResult = { valid: true } | { valid: false; error: string };

const validateSplits = (splits: SplitInput[]): SplitValidationResult => {
  if (splits.length < 2) {
    return {
      valid: false,
      error: "Split rules require at least 2 split lines",
    };
  }

  for (const s of splits) {
    if (s.side !== "debit" && s.side !== "credit") {
      return {
        valid: false,
        error: `Invalid side "${s.side}", must be "debit" or "credit"`,
      };
    }
    const hasPct = s.percentage != null && s.percentage !== "";
    const hasFixed = s.fixedAmount != null && s.fixedAmount !== "";
    if (hasPct && hasFixed) {
      return {
        valid: false,
        error: "Split cannot have both percentage and fixedAmount",
      };
    }
    if (!hasPct && !hasFixed) {
      return {
        valid: false,
        error: "Split must have either percentage or fixedAmount",
      };
    }
    if (hasPct) {
      const n = Number(s.percentage);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        return {
          valid: false,
          error: `Invalid percentage "${s.percentage}"`,
        };
      }
    }
    if (hasFixed) {
      const n = Number(s.fixedAmount);
      if (!Number.isFinite(n) || n <= 0) {
        return {
          valid: false,
          error: `Invalid fixedAmount "${s.fixedAmount}"`,
        };
      }
    }
  }

  const debitSplits = splits.filter((s) => s.side === "debit");
  const creditSplits = splits.filter((s) => s.side === "credit");

  if (debitSplits.length === 0 || creditSplits.length === 0) {
    return {
      valid: false,
      error: "Split rules must have both debit and credit side splits",
    };
  }

  // If all splits on a side are percentage-based, they must sum to 100
  const validateSideSum = (
    sideSplits: SplitInput[],
    sideName: string,
  ): SplitValidationResult => {
    const allPct = sideSplits.every(
      (s) => s.percentage != null && s.percentage !== "",
    );
    if (!allPct) return { valid: true };
    const sum = sideSplits.reduce((acc, s) => acc + Number(s.percentage), 0);
    if (Math.abs(sum - 100) > 0.01) {
      return {
        valid: false,
        error: `${sideName} percentages must sum to 100 (got ${sum.toFixed(2)})`,
      };
    }
    return { valid: true };
  };

  const debitCheck = validateSideSum(debitSplits, "Debit");
  if (!debitCheck.valid) return debitCheck;

  const creditCheck = validateSideSum(creditSplits, "Credit");
  if (!creditCheck.valid) return creditCheck;

  return { valid: true };
};

const splitBodySchema = t.Object({
  accountId: t.String(),
  side: t.String(),
  percentage: t.Optional(t.String()),
  fixedAmount: t.Optional(t.String()),
  memo: t.Optional(t.String()),
  tagId: t.Optional(t.String()),
  sortOrder: t.Optional(t.Number()),
});

// Categorization rule routes
const categorizationRuleRoutes = new Elysia({
  prefix: "/api/categorization-rules",
})
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rules = await dbPool
      .select()
      .from(categorizationRuleTable)
      .where(eq(categorizationRuleTable.bookId, bookId))
      .orderBy(desc(categorizationRuleTable.priority));

    const rulesWithSplits = await Promise.all(
      rules.map(async (rule) => {
        const splits = await dbPool
          .select()
          .from(categorizationRuleSplitTable)
          .where(eq(categorizationRuleSplitTable.ruleId, rule.id))
          .orderBy(asc(categorizationRuleSplitTable.sortOrder));
        return { ...rule, splits };
      }),
    );

    return { rules: rulesWithSplits };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (body.splits !== undefined && body.splits.length > 0) {
        const validation = validateSplits(body.splits);
        if (!validation.valid) {
          set.status = 400;
          return { error: validation.error };
        }
      }

      const rule = await dbPool.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(categorizationRuleTable)
          .values({
            bookId: body.bookId,
            name: body.name,
            matchField: body.matchField,
            matchType: body.matchType,
            matchValue: body.matchValue,
            debitAccountId: body.debitAccountId,
            creditAccountId: body.creditAccountId,
            amountMin: body.amountMin ?? null,
            amountMax: body.amountMax ?? null,
            confidence: body.confidence ?? "1.00",
            priority: body.priority ?? 0,
          })
          .returning();

        if (body.splits && body.splits.length >= 2) {
          await tx.insert(categorizationRuleSplitTable).values(
            body.splits.map((s, i) => ({
              ruleId: inserted.id,
              accountId: s.accountId,
              side: s.side,
              percentage: s.percentage ?? null,
              fixedAmount: s.fixedAmount ?? null,
              memo: s.memo ?? null,
              tagId: s.tagId ?? null,
              sortOrder: s.sortOrder ?? i,
            })),
          );
        }

        return inserted;
      });

      set.status = 201;

      emitAudit({
        type: "myfi.rule.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "categorization_rule", id: rule.id, name: rule.name },
        data: {
          matchField: body.matchField,
          matchType: body.matchType,
          matchValue: body.matchValue,
        },
      });

      return { rule };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        matchField: t.String(),
        matchType: t.String(),
        matchValue: t.String(),
        debitAccountId: t.String(),
        creditAccountId: t.String(),
        amountMin: t.Optional(t.Nullable(t.String())),
        amountMax: t.Optional(t.Nullable(t.String())),
        confidence: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        splits: t.Optional(t.Array(splitBodySchema)),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select()
        .from(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Categorization rule not found" };
      }

      if (body.splits !== undefined && body.splits.length > 0) {
        const validation = validateSplits(body.splits);
        if (!validation.valid) {
          set.status = 400;
          return { error: validation.error };
        }
      }

      const { splits, ...ruleUpdates } = body;

      const rule = await dbPool.transaction(async (tx) => {
        const [updated] = await tx
          .update(categorizationRuleTable)
          .set(ruleUpdates)
          .where(eq(categorizationRuleTable.id, id))
          .returning();

        if (splits !== undefined) {
          await tx
            .delete(categorizationRuleSplitTable)
            .where(eq(categorizationRuleSplitTable.ruleId, id));

          if (splits.length >= 2) {
            await tx.insert(categorizationRuleSplitTable).values(
              splits.map((s, i) => ({
                ruleId: id,
                accountId: s.accountId,
                side: s.side,
                percentage: s.percentage ?? null,
                fixedAmount: s.fixedAmount ?? null,
                memo: s.memo ?? null,
                tagId: s.tagId ?? null,
                sortOrder: s.sortOrder ?? i,
              })),
            );
          }
        }

        return updated;
      });

      emitAudit({
        type: "myfi.rule.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "categorization_rule",
          id: params.id,
          name: rule.name,
        },
      });

      return { rule };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        matchField: t.Optional(t.String()),
        matchType: t.Optional(t.String()),
        matchValue: t.Optional(t.String()),
        debitAccountId: t.Optional(t.String()),
        creditAccountId: t.Optional(t.String()),
        amountMin: t.Optional(t.Nullable(t.String())),
        amountMax: t.Optional(t.Nullable(t.String())),
        confidence: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        splits: t.Optional(t.Array(splitBodySchema)),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select()
        .from(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Categorization rule not found" };
      }

      await dbPool
        .delete(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      emitAudit({
        type: "myfi.rule.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "categorization_rule",
          id: params.id,
          name: existing.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default categorizationRuleRoutes;
