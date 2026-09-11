export const posPaymentMethods = new Set([
  "cash",
  "bankTransfer",
  "pos",
  "card",
  "cheque",
  "mobileMoney",
  "onlinePayment",
  "other",
]);

export function isValidPosPaymentMethod(value: unknown) {
  return typeof value === "string" && posPaymentMethods.has(value);
}

export function normalizePosMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type PosRepaymentResult =
  | { ok: false; error: string }
  | {
      ok: true;
      amount: number;
      amountPaid: number;
      balanceDue: number;
      currentBalance: number;
      paymentStatus: "partPaid" | "paid";
    };

export function calculatePosRepayment(totalAmount: number, currentAmountPaid: number, requestedAmount: number): PosRepaymentResult {
  const total = normalizePosMoney(totalAmount);
  const paid = normalizePosMoney(currentAmountPaid);
  const amount = normalizePosMoney(requestedAmount);
  const currentBalance = normalizePosMoney(Math.max(0, total - paid));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a positive payment amount." };
  }
  if (currentBalance <= 0) {
    return { ok: false, error: "This invoice has already been paid in full." };
  }
  if (amount > currentBalance) {
    return { ok: false, error: `Only ${currentBalance.toFixed(2)} remains due on this invoice.` };
  }

  const amountPaid = normalizePosMoney(Math.min(total, paid + amount));
  const balanceDue = normalizePosMoney(Math.max(0, total - amountPaid));
  return {
    ok: true,
    amount,
    amountPaid,
    balanceDue,
    currentBalance,
    paymentStatus: balanceDue > 0 ? "partPaid" as const : "paid" as const,
  };
}
