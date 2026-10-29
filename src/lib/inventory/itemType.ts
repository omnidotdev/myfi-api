// Inventory items are stock-tracked and post COGS against an asset account.
// Service and non-inventory items are sold but hold no stock, so they carry no
// asset or COGS account and never post stock movements
export const ITEM_TYPES = ["inventory", "service", "non_inventory"] as const;

type ItemType = (typeof ITEM_TYPES)[number];

export const isValidItemType = (value: string): value is ItemType =>
  (ITEM_TYPES as readonly string[]).includes(value);

/**
 * Resolve the asset/COGS account fields for an item of the given type.
 * Inventory items require both accounts; service and non-inventory items track
 * no stock, so their accounts are always null regardless of what is supplied
 */
export const resolveItemAccounts = (
  itemType: ItemType,
  input: { assetAccountId?: string | null; cogsAccountId?: string | null },
): { assetAccountId: string | null; cogsAccountId: string | null } => {
  if (itemType === "inventory") {
    if (!input.assetAccountId || !input.cogsAccountId) {
      throw new Error(
        "Inventory items require an asset account and a COGS account",
      );
    }
    return {
      assetAccountId: input.assetAccountId,
      cogsAccountId: input.cogsAccountId,
    };
  }
  return { assetAccountId: null, cogsAccountId: null };
};
