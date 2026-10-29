import { and, eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "lib/db/schema";

interface ValueInput {
  definitionId: string;
  value: string | null;
}

/**
 * Upsert custom-field values for one entity row. Each value targets a field
 * definition that must belong to the same book (guards against writing values
 * against another tenant's field). A null or empty value clears the field.
 * Returns the number of definitions written
 */
export const setCustomFieldValues = async (params: {
  bookId: string;
  entityId: string;
  values: ValueInput[];
}): Promise<number> => {
  const { bookId, entityId, values } = params;
  if (values.length === 0) return 0;

  const definitionIds = [...new Set(values.map((v) => v.definitionId))];
  const defs = await dbPool
    .select({ id: customFieldDefinitionTable.id })
    .from(customFieldDefinitionTable)
    .where(
      and(
        eq(customFieldDefinitionTable.bookId, bookId),
        inArray(customFieldDefinitionTable.id, definitionIds),
      ),
    );
  if (defs.length !== definitionIds.length) {
    throw new Error("One or more custom fields do not belong to this book");
  }

  for (const v of values) {
    const normalized = v.value?.trim() ? v.value : null;
    await dbPool
      .insert(customFieldValueTable)
      .values({
        bookId,
        definitionId: v.definitionId,
        entityId,
        value: normalized,
      })
      .onConflictDoUpdate({
        target: [
          customFieldValueTable.definitionId,
          customFieldValueTable.entityId,
        ],
        set: { value: normalized, updatedAt: new Date().toISOString() },
      });
  }

  return values.length;
};
