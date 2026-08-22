import type { Deal, DealQuoteLine, InstallationCostLine, InstallationMaterialLine } from "@/types/crm";

function defaultId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function quoteLinesToInstallationPlan(
  lines: DealQuoteLine[] | undefined,
  createId: (prefix: string) => string = defaultId,
): { costLines: InstallationCostLine[]; materials: InstallationMaterialLine[] } {
  const quoteLines = lines ?? [];
  const materials = quoteLines
    .filter((line) => line.lineType === "inventoryProduct" && line.fulfillment !== "directToSite" && Boolean(line.offeringId))
    .map((line): InstallationMaterialLine => ({
      id: createId("mat"),
      offeringId: line.offeringId as string,
      offeringName: line.offeringName || line.description,
      ...(line.sku ? { sku: line.sku } : {}),
      ...(line.brandId ? { brandId: line.brandId } : {}),
      ...(line.brandName ? { brandName: line.brandName } : {}),
      quantityRequired: Number(line.quantity || 0),
      estimatedUnitCost: Number(line.estimatedUnitCost || 0),
      notes: line.fulfillment === "procureToStock" ? "Planned for procurement into inventory" : "Check stock and reserve before issue",
    }));
  const costLines = quoteLines
    .filter((line) => line.lineType !== "inventoryProduct" || line.fulfillment === "directToSite")
    .map((line): InstallationCostLine => ({
      id: createId("cost"),
      category: line.lineType === "inventoryProduct" || line.lineType === "externalMaterial"
        ? "externalMaterial"
        : line.lineType === "labour"
          ? "labour"
          : line.lineType === "transport"
            ? "transport"
            : line.lineType === "service"
              ? "service"
              : "other",
      description: line.description,
      quantity: Number(line.quantity || 0),
      estimatedUnitCost: Number(line.estimatedUnitCost || 0),
      actualAmount: 0,
      paymentStatus: "notPaid",
      notes: line.fulfillment === "directToSite" ? "Planned direct-to-site procurement from accepted deal quotation" : "Planned from accepted deal quotation",
    }));

  return { costLines, materials };
}

export function dealToInstallationPlan(
  deal: Deal | undefined,
  createId: (prefix: string) => string = defaultId,
) {
  if (!deal) return { costLines: [], materials: [] };
  if (deal.quoteLines?.length) return quoteLinesToInstallationPlan(deal.quoteLines, createId);

  // Deals created before multi-line quotations still carry their selected
  // product/service. Convert that legacy line so project users never need to
  // enter the same requirement again.
  if (!deal.offeringId && !deal.offeringName) return { costLines: [], materials: [] };
  const inventoryItem = ["material", "solarEquipment"].includes(String(deal.offeringType ?? ""));
  const quantity = Math.max(0, Number(deal.offeringQuantity ?? 1) || 1);
  const legacyLine: DealQuoteLine = {
    id: `legacy-${deal.id}`,
    lineType: inventoryItem ? "inventoryProduct" : "service",
    fulfillment: inventoryItem ? "checkStock" : "service",
    ...(deal.offeringId ? { offeringId: deal.offeringId } : {}),
    ...(deal.offeringName ? { offeringName: deal.offeringName } : {}),
    ...(deal.offeringType ? { offeringType: deal.offeringType } : {}),
    description: deal.offeringName || deal.title,
    quantity,
    unitOfMeasure: "unit",
    unitPrice: Number(deal.offeringUnitPrice ?? 0),
    discountAmount: 0,
    taxRate: 0,
    estimatedUnitCost: 0,
    subtotal: Number(deal.quoteSubtotal ?? quantity * Number(deal.offeringUnitPrice ?? 0)),
    taxAmount: 0,
    totalAmount: Number(deal.quoteTotal ?? deal.quoteSubtotal ?? quantity * Number(deal.offeringUnitPrice ?? 0)),
  };
  return quoteLinesToInstallationPlan([legacyLine], createId);
}
