import type { Offering } from "@/types/crm";

export function filterPurchaseProducts(items: Offering[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;

  return items.filter((item) =>
    [
      item.name,
      item.brandName,
      item.sku,
      item.barcode,
      item.category,
      item.referenceNumber,
      item.supplierName,
    ].some((value) => String(value ?? "").toLowerCase().includes(needle)),
  );
}

export function purchaseProductOptions(
  items: Offering[],
  filteredItems: Offering[],
  selectedOfferingId: string,
) {
  const selectedItem = items.find((item) => item.id === selectedOfferingId);
  if (!selectedItem || filteredItems.some((item) => item.id === selectedItem.id)) {
    return filteredItems;
  }
  return [selectedItem, ...filteredItems];
}
