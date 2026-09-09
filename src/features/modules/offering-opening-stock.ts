export function parseInitialStockQuantity(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Initial stock must be zero or a positive number.");
  }

  return quantity;
}

export function parseStockAdjustmentQuantity(value: string) {
  const quantity = Number(value);
  if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  return quantity;
}

export function isInventoryOfferingType(type: unknown) {
  return type === "material" || type === "solarEquipment";
}
