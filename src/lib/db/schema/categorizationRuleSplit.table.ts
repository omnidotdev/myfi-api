import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { categorizationRuleTable } from "./categorizationRule.table";
import { tagTable } from "./tag.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const categorizationRuleSplitTable = pgTable(
  "categorization_rule_split",
  {
    id: generateDefaultId(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => categorizationRuleTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    side: text().notNull(),
    percentage: numeric({ precision: 7, scale: 4 }),
    fixedAmount: numeric("fixed_amount", { precision: 19, scale: 4 }),
    memo: text(),
    tagId: uuid("tag_id").references(() => tagTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("cat_rule_split_rule_id_idx").on(table.ruleId),
  ],
);

export type InsertCategorizationRuleSplit = InferInsertModel<
  typeof categorizationRuleSplitTable
>;
export type SelectCategorizationRuleSplit = InferSelectModel<
  typeof categorizationRuleSplitTable
>;
