import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { formTemplateTable } from "lib/db/schema";

/**
 * Make one template the default for its document type, clearing the flag on all
 * other templates of the same type in the book so exactly one stays default.
 * Runs in a transaction. The template must belong to the book
 */
export const setDefaultFormTemplate = async (
  bookId: string,
  templateId: string,
): Promise<void> => {
  const [template] = await dbPool
    .select()
    .from(formTemplateTable)
    .where(eq(formTemplateTable.id, templateId));
  if (!template || template.bookId !== bookId) {
    throw new Error("Form template not found");
  }

  await dbPool.transaction(async (tx) => {
    await tx
      .update(formTemplateTable)
      .set({ isDefault: false })
      .where(
        and(
          eq(formTemplateTable.bookId, bookId),
          eq(formTemplateTable.documentType, template.documentType),
        ),
      );
    await tx
      .update(formTemplateTable)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(formTemplateTable.id, templateId));
  });
};
