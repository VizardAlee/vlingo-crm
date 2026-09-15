export interface AdjustableSaleLine {
  discountAmount: number;
  quantity: number;
  unitPrice: number;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function stockDeltaForRevision(previousQuantity: number, revisedQuantity: number) {
  return revisedQuantity - previousQuantity;
}

export function calculateAdjustedSale(lines: AdjustableSaleLine[], taxRate: number, amountPaid: number) {
  const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discountAmount = money(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const taxAmount = money((subtotal - discountAmount) * taxRate / 100);
  const totalAmount = money(subtotal - discountAmount + taxAmount);
  const paid = money(amountPaid);
  if (totalAmount < paid) {
    return {
      ok: false as const,
      error: `The revised total cannot be below the ${paid} already received. Void the sale and record the refund separately.`,
    };
  }
  const balanceDue = money(totalAmount - paid);
  return {
    ok: true as const,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    balanceDue,
    paymentStatus: paid <= 0 ? "unpaid" as const : balanceDue > 0 ? "partPaid" as const : "paid" as const,
  };
}
