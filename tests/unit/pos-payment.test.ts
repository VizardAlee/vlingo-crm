import { describe, expect, it } from "vitest";
import { isValidPosPaymentMethod } from "../../functions/src/pos-payment";

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
});
