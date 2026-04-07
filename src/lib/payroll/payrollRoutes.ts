import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import {
  GUSTO_CLIENT_ID,
  GUSTO_CLIENT_SECRET,
  GUSTO_REDIRECT_URI,
} from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  payrollConnectionTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { encryptToken } from "lib/encryption/tokenEncryption";
import syncPayroll from "./syncPayroll";

/**
 * OAuth callback route (public, registered before auth middleware).
 */
export const payrollCallbackRoute = new Elysia().get(
  "/api/payroll/callback",
  async ({ query, set }) => {
    const { code, state: bookId } = query;

    if (!code || !bookId) {
      set.status = 400;
      return { error: "Missing code or state parameter" };
    }

    if (!GUSTO_CLIENT_ID || !GUSTO_CLIENT_SECRET || !GUSTO_REDIRECT_URI) {
      set.status = 500;
      return { error: "Gusto OAuth not configured" };
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.gusto.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: GUSTO_CLIENT_ID,
        client_secret: GUSTO_CLIENT_SECRET,
        code,
        redirect_uri: GUSTO_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      set.status = 502;
      return { error: "Failed to exchange Gusto authorization code" };
    }

    const tokens: { access_token: string; refresh_token: string } =
      await tokenRes.json();

    // Fetch company info
    const meRes = await fetch("https://api.gusto.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!meRes.ok) {
      set.status = 502;
      return { error: "Failed to fetch Gusto company info" };
    }

    const meData: { uuid: string } = await meRes.json();

    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);

    await dbPool.insert(payrollConnectionTable).values({
      bookId,
      provider: "gusto",
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      companyId: meData.uuid,
      status: "active",
    });

    set.redirect = "/settings/connections";
  },
  {
    query: t.Object({
      code: t.String(),
      state: t.String(),
    }),
  },
);

/**
 * Protected payroll routes (registered after auth middleware).
 */
const payrollRoutes = new Elysia({ prefix: "/api/payroll" })
  .post(
    "/connect",
    async ({ body, set }) => {
      const { bookId } = body;

      if (!GUSTO_CLIENT_ID || !GUSTO_REDIRECT_URI) {
        set.status = 500;
        return { error: "Gusto OAuth not configured" };
      }

      const authUrl = `https://api.gusto.com/oauth/authorize?client_id=${GUSTO_CLIENT_ID}&redirect_uri=${encodeURIComponent(GUSTO_REDIRECT_URI)}&response_type=code&state=${bookId}`;

      return { authUrl };
    },
    {
      body: t.Object({ bookId: t.String() }),
    },
  )
  .get(
    "/status",
    async ({ query, set }) => {
      const { bookId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const [connection] = await dbPool
        .select({
          id: payrollConnectionTable.id,
          provider: payrollConnectionTable.provider,
          status: payrollConnectionTable.status,
          lastSyncedAt: payrollConnectionTable.lastSyncedAt,
          companyId: payrollConnectionTable.companyId,
        })
        .from(payrollConnectionTable)
        .where(
          and(
            eq(payrollConnectionTable.bookId, bookId),
            eq(payrollConnectionTable.status, "active"),
          ),
        );

      return connection ?? null;
    },
    {
      query: t.Object({ bookId: t.String() }),
    },
  )
  .post(
    "/sync",
    async ({ body, set }) => {
      const { bookId } = body;

      const [connection] = await dbPool
        .select()
        .from(payrollConnectionTable)
        .where(
          and(
            eq(payrollConnectionTable.bookId, bookId),
            eq(payrollConnectionTable.status, "active"),
          ),
        );

      if (!connection) {
        set.status = 404;
        return { error: "No active payroll connection found" };
      }

      const result = await syncPayroll(connection);

      return { result };
    },
    {
      body: t.Object({ bookId: t.String() }),
    },
  )
  .delete(
    "/disconnect/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [connection] = await dbPool
        .select({
          id: payrollConnectionTable.id,
          bookId: payrollConnectionTable.bookId,
        })
        .from(payrollConnectionTable)
        .where(eq(payrollConnectionTable.id, id));

      if (!connection) {
        set.status = 404;
        return { error: "Payroll connection not found" };
      }

      await dbPool
        .update(payrollConnectionTable)
        .set({ status: "disconnected" })
        .where(eq(payrollConnectionTable.id, id));

      // Look up book for audit
      const [book] = await dbPool
        .select({ organizationId: bookTable.organizationId })
        .from(bookTable)
        .where(eq(bookTable.id, connection.bookId));

      if (book) {
        emitAudit({
          type: "myfi.payroll.disconnected",
          organizationId: book.organizationId,
          actor: SYSTEM_ACTOR,
          resource: {
            type: "payroll_connection",
            id: connection.id,
          },
        });
      }

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/import-csv",
    async ({ body, set }) => {
      const { bookId, file } = body;

      const content = await file.text();
      const lines = content.trim().split("\n");

      if (lines.length < 2) {
        set.status = 400;
        return {
          error: "CSV file must have a header row and at least one data row",
        };
      }

      const header = lines[0]
        .toLowerCase()
        .split(",")
        .map((h) => h.trim());
      const requiredColumns = [
        "date",
        "gross_wages",
        "federal_tax",
        "state_tax",
        "fica",
        "benefits",
        "net_pay",
      ];

      for (const col of requiredColumns) {
        if (!header.includes(col)) {
          set.status = 400;
          return { error: `Missing required column: ${col}` };
        }
      }

      const colIndex = Object.fromEntries(
        requiredColumns.map((col) => [col, header.indexOf(col)]),
      );

      // Fetch account mappings for this book
      const mappings = await dbPool
        .select()
        .from(accountMappingTable)
        .where(eq(accountMappingTable.bookId, bookId));

      const mappingsByEvent = new Map(mappings.map((m) => [m.eventType, m]));

      let importedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((v) => v.trim());

        if (row.length < requiredColumns.length) continue;

        const sourceRef = `csv:${file.name}:${i}`;

        // Idempotency check
        const [existing] = await dbPool
          .select({ id: journalEntryTable.id })
          .from(journalEntryTable)
          .where(
            and(
              eq(journalEntryTable.bookId, bookId),
              eq(journalEntryTable.source, "payroll_import"),
              eq(journalEntryTable.sourceReferenceId, sourceRef),
            ),
          );

        if (existing) {
          skippedCount++;
          continue;
        }

        const date = row[colIndex.date];
        const grossWages = Number.parseFloat(row[colIndex.gross_wages]) || 0;
        const federalTax = Number.parseFloat(row[colIndex.federal_tax]) || 0;
        const stateTax = Number.parseFloat(row[colIndex.state_tax]) || 0;
        const fica = Number.parseFloat(row[colIndex.fica]) || 0;
        const benefits = Number.parseFloat(row[colIndex.benefits]) || 0;
        const netPay = Number.parseFloat(row[colIndex.net_pay]) || 0;

        const journalLines: {
          accountId: string;
          debit: string;
          credit: string;
        }[] = [];

        // Gross wages (debit to expense)
        const wagesMapping = mappingsByEvent.get("payroll_gross_wages");
        if (wagesMapping && grossWages) {
          journalLines.push({
            accountId: wagesMapping.debitAccountId,
            debit: grossWages.toFixed(4),
            credit: "0.0000",
          });
        }

        // Federal tax (credit to liability)
        const fedTaxMapping = mappingsByEvent.get("payroll_employee_tax");
        if (fedTaxMapping && federalTax) {
          journalLines.push({
            accountId: fedTaxMapping.creditAccountId,
            debit: "0.0000",
            credit: federalTax.toFixed(4),
          });
        }

        // State tax (credit to liability, same mapping)
        if (fedTaxMapping && stateTax) {
          journalLines.push({
            accountId: fedTaxMapping.creditAccountId,
            debit: "0.0000",
            credit: stateTax.toFixed(4),
          });
        }

        // FICA (credit to liability, employer tax mapping)
        const ficaMapping = mappingsByEvent.get("payroll_employer_tax");
        if (ficaMapping && fica) {
          journalLines.push({
            accountId: ficaMapping.creditAccountId,
            debit: "0.0000",
            credit: fica.toFixed(4),
          });
        }

        // Benefits (credit to liability)
        const benefitsMapping = mappingsByEvent.get("payroll_benefits");
        if (benefitsMapping && benefits) {
          journalLines.push({
            accountId: benefitsMapping.creditAccountId,
            debit: "0.0000",
            credit: benefits.toFixed(4),
          });
        }

        // Net pay (credit to bank/asset)
        const netPayMapping = mappingsByEvent.get("payroll_net_pay");
        if (netPayMapping && netPay) {
          journalLines.push({
            accountId: netPayMapping.creditAccountId,
            debit: "0.0000",
            credit: netPay.toFixed(4),
          });
        }

        const [entry] = await dbPool
          .insert(journalEntryTable)
          .values({
            bookId,
            date,
            memo: `Payroll CSV import: ${date}`,
            source: "payroll_import",
            sourceReferenceId: sourceRef,
            isReviewed: false,
            isReconciled: false,
          })
          .returning();

        if (journalLines.length > 0) {
          await dbPool.insert(journalLineTable).values(
            journalLines.map((line) => ({
              journalEntryId: entry.id,
              ...line,
            })),
          );
        }

        const txnDate = new Date(date);

        await dbPool.insert(reconciliationQueueTable).values({
          bookId,
          journalEntryId: entry.id,
          status: "pending",
          categorizationSource: "rule",
          confidence: "0.80",
          priority: 1,
          periodYear: txnDate.getFullYear(),
          periodMonth: txnDate.getMonth() + 1,
        });

        importedCount++;
      }

      return { importedCount, skippedCount };
    },
    {
      body: t.Object({
        bookId: t.String(),
        file: t.File(),
      }),
    },
  );

export default payrollRoutes;
