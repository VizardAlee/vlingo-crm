import type { InventoryBalance, Offering } from "@/types/crm";

export function organizationInventoryCatalog(items: Offering[]) {
  return items.filter((item) => Boolean(item.brandId));
}

export function branchInventoryCatalog(
  items: Offering[],
  balances: InventoryBalance[],
  branchId: string,
) {
  const branchOfferingIds = new Set(
    balances
      .filter((balance) => balance.branchId === branchId)
      .map((balance) => balance.offeringId),
  );

  return organizationInventoryCatalog(items).filter(
    (item) => item.branchId === branchId || branchOfferingIds.has(item.id),
  );
}
