import { describe, expect, it } from "vitest";
import {
  safeCsvCell,
  scopePurchase,
  scopeSale,
} from "../../src/features/reports/organization-report-utils";

describe("organization report calculations", () => {
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
