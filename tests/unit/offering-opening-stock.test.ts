import { describe, expect, it } from "vitest";
import { isInventoryOfferingType, parseInitialStockQuantity, parseStockAdjustmentQuantity } from "../../src/features/modules/offering-opening-stock";

describe("product opening stock", () => {
  it("treats blank and zero quantities as no opening movement", () => {
    expect(parseInitialStockQuantity("")).toBe(0);
    expect(parseInitialStockQuantity("  ")).toBe(0);
    expect(parseInitialStockQuantity("0")).toBe(0);
  });

  it("accepts positive whole or fractional opening quantities", () => {
    expect(parseInitialStockQuantity("20")).toBe(20);
    expect(parseInitialStockQuantity("2.5")).toBe(2.5);
  });

  it("rejects negative and invalid opening quantities", () => {
    expect(() => parseInitialStockQuantity("-1")).toThrow("zero or a positive number");
    expect(() => parseInitialStockQuantity("not-a-number")).toThrow("zero or a positive number");
  });

  it("requires a positive stock-adjustment quantity", () => {
    expect(parseStockAdjustmentQuantity("15")).toBe(15);
    expect(parseStockAdjustmentQuantity("2.5")).toBe(2.5);
    expect(() => parseStockAdjustmentQuantity("")).toThrow("greater than zero");
    expect(() => parseStockAdjustmentQuantity("0")).toThrow("greater than zero");
    expect(() => parseStockAdjustmentQuantity("-1")).toThrow("greater than zero");
  });

  it("only treats physical catalog types as inventory products", () => {
    expect(isInventoryOfferingType("material")).toBe(true);
    expect(isInventoryOfferingType("solarEquipment")).toBe(true);
    expect(isInventoryOfferingType("service")).toBe(false);
  });
});
