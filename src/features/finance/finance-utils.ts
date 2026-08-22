import type { Deal, DealFinanceStatus, FinanceApprovalStatus, FinancePayment, FinancePaymentSourceType, FinanceRevenueCategory, Lead, PaymentVerificationStatus, RentalPaymentRecord, RentalTenancy } from "@/types/crm";

const revenueCategories: FinanceRevenueCategory[] = ["realEstate", "solar", "buildingMaterials", "generalServices", "custom", "propertySale", "unitSale", "rental", "other"];

export function createReceiptNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RCT-${date}-${suffix}`;
}

export function paymentTotal(payments: RentalPaymentRecord[] | undefined, statuses: PaymentVerificationStatus[] = ["pending", "verified"]) {
  return Array.isArray(payments)
    ? payments
      .filter((payment) => statuses.includes(payment.verificationStatus ?? "verified"))
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    : 0;
}

export function rentalBalance(rental: Pick<RentalTenancy, "paymentHistory" | "rentAmount">) {
  return Math.max(Number(rental.rentAmount ?? 0) - paymentTotal(rental.paymentHistory), 0);
}

export function paymentStatusForAmount(amount: number, rental: Pick<RentalTenancy, "paymentHistory" | "rentAmount">) {
  const nextTotal = paymentTotal(rental.paymentHistory) + amount;
  return nextTotal >= Number(rental.rentAmount ?? 0) ? "paid" : "partPaid";
}

export function dealTargetAmount(deal: Pick<Deal, "agreedAmount" | "depositAmount" | "offerAmount" | "quoteSubtotal" | "quoteTotal" | "reservationAmount">) {
  return Number(deal.agreedAmount ?? deal.quoteTotal ?? deal.quoteSubtotal ?? deal.offerAmount ?? deal.depositAmount ?? deal.reservationAmount ?? 0);
}

export function normalizeRevenueCategory(value: unknown): FinanceRevenueCategory {
  const category = String(value ?? "");
  return revenueCategories.includes(category as FinanceRevenueCategory) ? category as FinanceRevenueCategory : "other";
}

export function revenueCategoryLabel(category: FinanceRevenueCategory) {
  if (category === "realEstate") {
    return "Real estate deals";
  }

  if (category === "buildingMaterials") {
    return "Building materials";
  }

  if (category === "generalServices") {
    return "Services and consultancy";
  }

  if (category === "propertySale") {
    return "Property sales";
  }

  if (category === "unitSale") {
    return "Unit sales";
  }

  if (category === "rental") {
    return "Rentals";
  }

  if (category === "solar") {
    return "Solar";
  }

  if (category === "custom") {
    return "Custom";
  }

  return "Other income";
}

export function revenueCategoryFromDeal(deal: Pick<Deal, "dealCategory" | "offeringVertical" | "propertyId" | "unitId">): FinanceRevenueCategory {
  const category = normalizeRevenueCategory(deal.dealCategory ?? deal.offeringVertical);
  if (category !== "other") {
    return category;
  }

  return deal.propertyId || deal.unitId ? "realEstate" : "other";
}

export function revenueCategoryFromLead(lead: Pick<Lead, "interestCategory" | "offeringVertical" | "propertyId" | "unitId">): FinanceRevenueCategory {
  const category = normalizeRevenueCategory(lead.interestCategory ?? lead.offeringVertical);
  if (category !== "other") {
    return category;
  }

  return lead.propertyId || lead.unitId ? "realEstate" : "other";
}

export function revenueCategoryFromPaymentSource(sourceType: FinancePaymentSourceType | undefined): FinanceRevenueCategory {
  if (sourceType === "rental") {
    return "rental";
  }

  if (sourceType === "property") {
    return "propertySale";
  }

  if (sourceType === "unit") {
    return "unitSale";
  }

  if (sourceType === "deal" || sourceType === "lead") {
    return "realEstate";
  }

  return "other";
}

export function revenueCategoryFromPayment(payment: Pick<FinancePayment, "revenueCategory" | "sourceType">): FinanceRevenueCategory {
  return payment.revenueCategory ? normalizeRevenueCategory(payment.revenueCategory) : revenueCategoryFromPaymentSource(payment.sourceType);
}

export function dealPaymentSummary(
  targetAmount: number,
  payments: Array<Pick<FinancePayment, "amount" | "verificationStatus">>,
): {
  balanceAmount: number;
  financeStatus: DealFinanceStatus;
  paidAmount: number;
  pendingPaymentAmount: number;
  recordedAmount: number;
} {
  const paidAmount = payments
    .filter((payment) => payment.verificationStatus === "verified")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingPaymentAmount = payments
    .filter((payment) => payment.verificationStatus === "pending")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const normalizedTarget = Math.max(Number(targetAmount || 0), 0);
  const balanceAmount = Math.max(normalizedTarget - paidAmount, 0);
  let financeStatus: DealFinanceStatus = "notInvoiced";

  if (normalizedTarget > 0 && paidAmount >= normalizedTarget) {
    financeStatus = "paid";
  } else if (paidAmount > 0) {
    financeStatus = "partPaid";
  } else if (pendingPaymentAmount > 0) {
    financeStatus = "paymentPending";
  }

  return {
    balanceAmount,
    financeStatus,
    paidAmount,
    pendingPaymentAmount,
    recordedAmount: paidAmount + pendingPaymentAmount,
  };
}

export function approvalTone(status: FinanceApprovalStatus | PaymentVerificationStatus) {
  if (status === "approved" || status === "paid" || status === "verified") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "warning";
}
