import { describe, expect, it } from "vitest";
import { calculateAdjustedSale, stockDeltaForRevision } from "../../functions/src/pos-sale-management";

describe("POS sale management", () => {
  it("recalculates a revised sale and its remaining balance", () => {
    expect(calculateAdjustedSale([
      { quantity: 3, unitPrice: 1_000, discountAmount: 100 },
      { quantity: 2, unitPrice: 500, discountAmount: 0 },
    ], 7.5, 1_000)).toEqual({
      ok: true,
      subtotal: 4_000,
      discountAmount: 100,
      taxAmount: 292.5,
      totalAmount: 4_192.5,
      balanceDue: 3_192.5,
      paymentStatus: "partPaid",
    });
  });

  it("blocks a revision below payments already received", () => {
    expect(calculateAdjustedSale([
      { quantity: 1, unitPrice: 1_000, discountAmount: 0 },
    ], 0, 1_200)).toMatchObject({ ok: false });
  });

  it("calculates whether a revision consumes or restores stock", () => {
    expect(stockDeltaForRevision(5, 8)).toBe(3);
    expect(stockDeltaForRevision(8, 5)).toBe(-3);
    expect(stockDeltaForRevision(5, 5)).toBe(0);
  });
});
