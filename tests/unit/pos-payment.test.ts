import { describe, expect, it } from "vitest";
import { calculatePosRepayment, isValidPosPaymentMethod } from "../../functions/src/pos-payment";

describe("POS payment validation", () => {
  it("accepts the POS terminal value sent by the checkout form", () => {
    expect(isValidPosPaymentMethod("pos")).toBe(true);
  });

  it("retains compatible payment values and rejects missing methods", () => {
    expect(isValidPosPaymentMethod("card")).toBe(true);
    expect(isValidPosPaymentMethod("bankTransfer")).toBe(true);
    expect(isValidPosPaymentMethod("")).toBe(false);
    expect(isValidPosPaymentMethod(undefined)).toBe(false);
  });

  it("accepts a whole-number full settlement despite fractional input constraints", () => {
    expect(calculatePosRepayment(37_700, 0, 37_700)).toMatchObject({
      ok: true,
      amount: 37_700,
      amountPaid: 37_700,
      balanceDue: 0,
      paymentStatus: "paid",
    });
  });

  it("accepts a part-payment and leaves the correct balance", () => {
    expect(calculatePosRepayment(37_700, 1_000, 10_000)).toMatchObject({
      ok: true,
      amountPaid: 11_000,
      balanceDue: 26_700,
      paymentStatus: "partPaid",
    });
  });

  it("normalizes currency precision and rejects overpayment", () => {
    expect(calculatePosRepayment(37_700, 0.0000001, 37_700)).toMatchObject({ ok: true, balanceDue: 0, paymentStatus: "paid" });
    expect(calculatePosRepayment(37_700, 0, 37_700.01)).toEqual({
      ok: false,
      error: "Only 37700.00 remains due on this invoice.",
    });
  });
});
