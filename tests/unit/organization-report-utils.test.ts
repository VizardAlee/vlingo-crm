import { describe, expect, it } from "vitest";
import {
  inventoryAvailabilityStatus,
  inventoryMovementDelta,
  normalizeReportScopeFilter,
  safeCsvCell,
  scopePurchase,
  scopeSale,
} from "../../src/features/reports/organization-report-utils";

describe("organization report calculations", () => {
  it("classifies inventory availability for replenishment reporting", () => {
    expect(inventoryAvailabilityStatus(0, 5)).toBe("outOfStock");
    expect(inventoryAvailabilityStatus(3, 5)).toBe("lowStock");
    expect(inventoryAvailabilityStatus(6, 5)).toBe("inStock");
    expect(inventoryAvailabilityStatus(2, null)).toBe("inStock");
  });

  it("reconstructs organization and branch stock changes from movements", () => {
    expect(inventoryMovementDelta({ movementType: "receipt", quantity: 10, toBranchId: "kano" }, "kano")).toBe(10);
    expect(inventoryMovementDelta({ movementType: "issue", quantity: 3, fromBranchId: "kano" }, "kano")).toBe(-3);
    expect(inventoryMovementDelta({ movementType: "transfer", quantity: 4, fromBranchId: "kano", toBranchId: "kaduna" }, "kano")).toBe(-4);
    expect(inventoryMovementDelta({ movementType: "transfer", quantity: 4, fromBranchId: "kano", toBranchId: "kaduna" }, "kaduna")).toBe(4);
    expect(inventoryMovementDelta({ movementType: "transfer", quantity: 4, fromBranchId: "kano", toBranchId: "kaduna" }, "")).toBe(0);
    expect(inventoryMovementDelta({ branchId: "kano", movementType: "adjustmentIn", quantity: 2 }, "kano")).toBe(2);
  });

  it("treats the all-brands UI value as an unrestricted report scope", () => {
    expect(normalizeReportScopeFilter("all")).toBe("");
    expect(normalizeReportScopeFilter(" ALL ")).toBe("");
    expect(normalizeReportScopeFilter(null)).toBe("");
    expect(normalizeReportScopeFilter("brand-bread")).toBe("brand-bread");
  });

  it("allocates a mixed-brand sale using line value", () => {
    const result = scopeSale(
      {
        lines: [
          { brandId: "bread", lineTotal: 600, quantity: 2, unitCost: 100 },
          { brandId: "revo", lineTotal: 400, quantity: 1, unitCost: 150 },
        ],
        totalAmount: 1_100,
      },
      "bread",
    );

    expect(result?.revenue).toBe(660);
    expect(result?.cost).toBe(200);
    expect(result?.lines).toHaveLength(1);
  });

  it("allocates purchase tax and payment proportionally by brand", () => {
    const result = scopePurchase(
      {
        amountPaid: 550,
        lines: [
          { brandId: "bread", quantity: 3, unitCost: 200 },
          { brandId: "revo", quantity: 2, unitCost: 200 },
        ],
        totalAmount: 1_100,
      },
      "bread",
    );

    expect(result?.amount).toBe(660);
    expect(result?.paid).toBe(330);
  });

  it("neutralizes spreadsheet formulas in CSV values", () => {
    expect(safeCsvCell("=HYPERLINK(\"bad\")")).toBe(
      '"\'=HYPERLINK(""bad"")"',
    );
    expect(safeCsvCell("Normal product")).toBe('"Normal product"');
  });
});
