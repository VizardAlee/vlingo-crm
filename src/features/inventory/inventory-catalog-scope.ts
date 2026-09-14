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

export interface InventoryItemFilters {
  search: string;
  brandId: string;
  productType: string;
  category: string;
  locationId: string;
}

export function filterInventoryMovementItems(
  items: Offering[],
  balances: InventoryBalance[],
  filters: InventoryItemFilters,
) {
  const search = filters.search.trim().toLowerCase();
  const locationOfferingIds = filters.locationId
    ? new Set(
        balances
          .filter((balance) => balance.locationId === filters.locationId)
          .map((balance) => balance.offeringId),
      )
    : null;

  return items.filter((item) => {
    if (filters.brandId && item.brandId !== filters.brandId) return false;
    if (filters.productType && item.type !== filters.productType) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (locationOfferingIds && !locationOfferingIds.has(item.id)) return false;
    if (!search) return true;

    return [
      item.name,
      item.brandName,
      item.sku,
      item.barcode,
      item.category,
      item.referenceNumber,
      item.supplierName,
    ].some((value) => String(value ?? "").toLowerCase().includes(search));
  });
}
