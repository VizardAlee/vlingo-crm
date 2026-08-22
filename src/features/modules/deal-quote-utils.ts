import type { DealQuoteLine } from "@/types/crm";

export function calculateDealQuoteLine(line: DealQuoteLine): DealQuoteLine {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
  const subtotal = quantity * unitPrice;
  const discountAmount = Math.min(subtotal, Math.max(0, Number(line.discountAmount) || 0));
  const taxableAmount = subtotal - discountAmount;
  const taxRate = Math.max(0, Math.min(100, Number(line.taxRate) || 0));
  const taxAmount = taxableAmount * taxRate / 100;
  return {
    ...line,
    discountAmount,
    estimatedUnitCost: Math.max(0, Number(line.estimatedUnitCost) || 0),
    quantity,
    subtotal,
    taxAmount,
    taxRate,
    totalAmount: taxableAmount + taxAmount,
    unitPrice,
  };
}

export function summarizeDealQuote(lines: DealQuoteLine[]) {
  return lines.reduce((summary, line) => ({
    discount: summary.discount + Number(line.discountAmount || 0),
    estimatedCost: summary.estimatedCost + Number(line.quantity || 0) * Number(line.estimatedUnitCost || 0),
    subtotal: summary.subtotal + Number(line.subtotal || 0),
    tax: summary.tax + Number(line.taxAmount || 0),
    total: summary.total + Number(line.totalAmount || 0),
  }), { discount: 0, estimatedCost: 0, subtotal: 0, tax: 0, total: 0 });
}
