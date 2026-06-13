import { describe, expect, it } from "vitest";
import { paymentStatusForAmount, paymentTotal, rentalBalance } from "../../src/features/finance/finance-utils";

describe("finance utilities", () => {
  it("totals pending and verified payments while excluding rejected payments", () => {
    expect(paymentTotal([
      { amount: 250000, at: "2026-06-12", method: "bankTransfer", userId: "user-1", verificationStatus: "pending" },
      { amount: 150000, at: "2026-06-12", method: "cash", userId: "user-1", verificationStatus: "verified" },
      { amount: 100000, at: "2026-06-12", method: "pos", userId: "user-1", verificationStatus: "rejected" },
    ])).toBe(400000);
  });

  it("computes rental balance and next payment status", () => {
    const rental = {
      paymentHistory: [{ amount: 300000, at: "2026-06-12", method: "bankTransfer" as const, userId: "user-1", verificationStatus: "verified" as const }],
      rentAmount: 500000,
    };

    expect(rentalBalance(rental)).toBe(200000);
    expect(paymentStatusForAmount(100000, rental)).toBe("partPaid");
    expect(paymentStatusForAmount(200000, rental)).toBe("paid");
  });
});
