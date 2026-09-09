export type PosPriceSource = "retail" | "wholesale" | "adjusted";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function optionalCatalogPrice(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const price = money(Number(value));
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Catalog prices must be valid non-negative amounts.");
  }
  return price;
}

export function resolvePosPrice(input: {
  retailPrice: unknown;
  wholesalePrice: unknown;
  requestedUnitPrice: unknown;
}) {
  const catalogRetailPrice = optionalCatalogPrice(input.retailPrice) ?? 0;
  const catalogWholesalePrice = optionalCatalogPrice(input.wholesalePrice);
  const requestedUnitPrice = optionalCatalogPrice(input.requestedUnitPrice);
  const unitPrice = requestedUnitPrice ?? catalogRetailPrice;
  const priceSource: PosPriceSource = unitPrice === catalogRetailPrice
    ? "retail"
    : catalogWholesalePrice !== undefined && unitPrice === catalogWholesalePrice
      ? "wholesale"
      : "adjusted";

  return {
    catalogRetailPrice,
    catalogWholesalePrice,
    priceAdjustment: money(unitPrice - catalogRetailPrice),
    priceSource,
    unitPrice,
  };
}
