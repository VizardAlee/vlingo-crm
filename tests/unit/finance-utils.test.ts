import { describe, expect, it } from "vitest";
import { dealPaymentSummary, dealTargetAmount, paymentStatusForAmount, paymentTotal, rentalBalance, revenueCategoryFromDeal, revenueCategoryFromLead, revenueCategoryFromPayment, revenueCategoryLabel } from "../../src/features/finance/finance-utils";

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

  it("computes deal target amount and finance summary from verified and pending receipts", () => {
    expect(dealTargetAmount({ agreedAmount: 45000000, offerAmount: 50000000 })).toBe(45000000);
    expect(dealTargetAmount({ offerAmount: 250000, quoteSubtotal: 1000000, quoteTotal: 1075000 })).toBe(1075000);
    expect(dealTargetAmount({ offerAmount: 250000, quoteSubtotal: 1000000 })).toBe(1000000);
    expect(dealTargetAmount({ depositAmount: 5000000, reservationAmount: 1000000 })).toBe(5000000);

    expect(dealPaymentSummary(45000000, [
      { amount: 10000000, verificationStatus: "verified" },
      { amount: 5000000, verificationStatus: "pending" },
      { amount: 2000000, verificationStatus: "rejected" },
    ])).toEqual({
      balanceAmount: 35000000,
      financeStatus: "partPaid",
      paidAmount: 10000000,
      pendingPaymentAmount: 5000000,
      recordedAmount: 15000000,
    });
  });

  it("marks unpaid deals as pending, paid, or not invoiced from receipt status", () => {
    expect(dealPaymentSummary(25000000, [{ amount: 5000000, verificationStatus: "pending" }]).financeStatus).toBe("paymentPending");
    expect(dealPaymentSummary(25000000, [{ amount: 25000000, verificationStatus: "verified" }]).financeStatus).toBe("paid");
    expect(dealPaymentSummary(25000000, [{ amount: 25000000, verificationStatus: "rejected" }]).financeStatus).toBe("notInvoiced");
  });

  it("classifies expanded revenue categories for deals, leads, and receipts", () => {
    expect(revenueCategoryFromDeal({ dealCategory: "solar" })).toBe("solar");
    expect(revenueCategoryFromDeal({ offeringVertical: "buildingMaterials" })).toBe("buildingMaterials");
    expect(revenueCategoryFromDeal({ propertyId: "property-1" })).toBe("realEstate");
    expect(revenueCategoryFromLead({ interestCategory: "generalServices" })).toBe("generalServices");
    expect(revenueCategoryFromPayment({ revenueCategory: "unitSale", sourceType: "unit" })).toBe("unitSale");
    expect(revenueCategoryFromPayment({ sourceType: "rental" })).toBe("rental");
    expect(revenueCategoryLabel("generalServices")).toBe("Services and consultancy");
  });
});
