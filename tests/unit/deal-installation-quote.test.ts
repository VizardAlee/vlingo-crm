import { describe, expect, it } from "vitest";
import { dealToInstallationPlan, quoteLinesToInstallationPlan } from "../../src/features/installations/installation-quote";
import { calculateDealQuoteLine, summarizeDealQuote } from "../../src/features/modules/deal-quote-utils";
import { dealSchema } from "../../src/lib/validation/schemas";
import type { DealQuoteLine } from "../../src/types/crm";

function line(overrides: Partial<DealQuoteLine>): DealQuoteLine {
  return calculateDealQuoteLine({
    id: "line-1",
    lineType: "inventoryProduct",
    fulfillment: "checkStock",
    description: "Solar panel",
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
    taxRate: 0,
    estimatedUnitCost: 0,
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    ...overrides,
  });
}

describe("installation deal quotations", () => {
  it("calculates discounts, tax, totals, and estimated cost", () => {
    const panel = line({ quantity: 2, unitPrice: 100_000, discountAmount: 20_000, taxRate: 7.5, estimatedUnitCost: 70_000 });

    expect(panel.subtotal).toBe(200_000);
    expect(panel.taxAmount).toBe(13_500);
    expect(panel.totalAmount).toBe(193_500);
    expect(summarizeDealQuote([panel])).toEqual({
      discount: 20_000,
      estimatedCost: 140_000,
      subtotal: 200_000,
      tax: 13_500,
      total: 193_500,
    });
  });

  it("separates inventory requirements from direct and service project costs", () => {
    let id = 0;
    const plan = quoteLinesToInstallationPlan([
      line({ id: "panel", offeringId: "panel-620w", offeringName: "620W panel", quantity: 12, estimatedUnitCost: 80_000 }),
      line({ id: "cable", offeringId: "cable-10mm", description: "10mm cable", fulfillment: "procureToStock", quantity: 100, estimatedUnitCost: 2_000 }),
      line({ id: "rail", lineType: "externalMaterial", fulfillment: "directToSite", description: "Custom mounting rail", quantity: 8, estimatedUnitCost: 15_000 }),
      line({ id: "labour", lineType: "labour", fulfillment: "service", description: "Installation labour", quantity: 1, estimatedUnitCost: 250_000 }),
      line({ id: "transport", lineType: "transport", fulfillment: "service", description: "Site delivery", quantity: 1, estimatedUnitCost: 75_000 }),
    ], (prefix) => `${prefix}-${++id}`);

    expect(plan.materials).toHaveLength(2);
    expect(plan.materials[0]).toMatchObject({ offeringId: "panel-620w", quantityRequired: 12 });
    expect(plan.materials[1]).toMatchObject({ offeringId: "cable-10mm", notes: "Planned for procurement into inventory" });
    expect(plan.costLines.map((item) => item.category)).toEqual(["externalMaterial", "labour", "transport"]);
    expect(plan.costLines[0]).toMatchObject({ description: "Custom mounting rail", estimatedUnitCost: 15_000 });
  });

  it("accepts the multi-line quotation in deal validation", () => {
    const result = dealSchema.safeParse({
      title: "Kano 10kVA installation",
      dealType: "sale",
      dealCategory: "solar",
      status: "qualified",
      quoteLines: [line({ offeringId: "panel-620w", offeringName: "620W panel", unitPrice: 130_000 })],
      quoteSubtotal: 130_000,
      quoteTotal: 130_000,
    });

    expect(result.success).toBe(true);
  });

  it("imports the selected item from a legacy deal without quotation lines", () => {
    const plan = dealToInstallationPlan({
      id: "deal-legacy",
      referenceNumber: "DEAL-1",
      title: "Legacy panel installation",
      dealType: "sale",
      status: "won",
      offeringId: "panel-550w",
      offeringName: "550W panel",
      offeringType: "solarEquipment",
      offeringQuantity: 16,
      offeringUnitPrice: 100_000,
      branchId: "branch-1",
      organizationId: "org-1",
      isDeleted: false,
      createdAt: new Date("2026-08-22"),
      createdBy: "user-1",
      updatedAt: new Date("2026-08-22"),
      updatedBy: "user-1",
    }, (prefix) => `${prefix}-1`);

    expect(plan.materials).toHaveLength(1);
    expect(plan.materials[0]).toMatchObject({ offeringId: "panel-550w", offeringName: "550W panel", quantityRequired: 16 });
    expect(plan.costLines).toHaveLength(0);
  });
});
