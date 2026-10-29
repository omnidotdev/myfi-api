import { and, eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  bundleComponentTable,
  inventoryItemTable,
  itemBundleTable,
} from "lib/db/schema";

interface ComponentInput {
  inventoryItemId: string;
  quantity: number;
}

interface CreateBundleResult {
  bundleId: string;
  componentCount: number;
}

/**
 * Create a bundle and its components. Every component item must belong to the
 * book, so a bundle can never reference another tenant's item. Bundle and
 * components are written in one transaction
 */
export const createBundle = async (params: {
  bookId: string;
  name: string;
  description?: string | null;
  components: ComponentInput[];
}): Promise<CreateBundleResult> => {
  const { bookId, name, description, components } = params;

  if (components.length === 0) {
    throw new Error("A bundle must include at least one component");
  }

  const itemIds = [...new Set(components.map((c) => c.inventoryItemId))];
  const items = await dbPool
    .select({ id: inventoryItemTable.id })
    .from(inventoryItemTable)
    .where(
      and(
        eq(inventoryItemTable.bookId, bookId),
        inArray(inventoryItemTable.id, itemIds),
      ),
    );
  if (items.length !== itemIds.length) {
    throw new Error("One or more bundle items do not belong to this book");
  }

  return dbPool.transaction(async (tx) => {
    const [bundle] = await tx
      .insert(itemBundleTable)
      .values({ bookId, name, description: description ?? null })
      .returning();
    if (!bundle) {
      throw new Error("Failed to create the bundle");
    }
    await tx.insert(bundleComponentTable).values(
      components.map((c) => ({
        bundleId: bundle.id,
        inventoryItemId: c.inventoryItemId,
        quantity: c.quantity.toFixed(4),
      })),
    );
    return { bundleId: bundle.id, componentCount: components.length };
  });
};
