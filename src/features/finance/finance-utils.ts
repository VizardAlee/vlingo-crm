import type { FinanceApprovalStatus, PaymentVerificationStatus, RentalPaymentRecord, RentalTenancy } from "@/types/crm";

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

export function approvalTone(status: FinanceApprovalStatus | PaymentVerificationStatus) {
  if (status === "approved" || status === "paid" || status === "verified") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "warning";
}
