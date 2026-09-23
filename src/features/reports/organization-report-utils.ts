type ReportRecord = Record<string, unknown>;

export function normalizeReportScopeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.toLowerCase() === "all" ? "" : normalized;
}

export function inventoryAvailabilityStatus(
  available: number,
  reorderLevel: number | null | undefined,
) {
  if (available <= 0) return "outOfStock" as const;
  if (Number(reorderLevel ?? 0) > 0 && available <= Number(reorderLevel))
    return "lowStock" as const;
  return "inStock" as const;
}

export function safeCsvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function saleLineAmount(line: ReportRecord) {
  return Number(
    line.lineTotal ??
      Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0) -
        Number(line.discountAmount ?? 0),
  );
}

export function scopeSale(sale: ReportRecord, brandId: string) {
  const lines = (Array.isArray(sale.lines) ? sale.lines : []) as ReportRecord[];
  const scopedLines = brandId
    ? lines.filter((line) => line.brandId === brandId)
    : lines;
  if (!scopedLines.length) return null;
  const cost = scopedLines.reduce(
    (total, line) =>
      total + Number(line.quantity ?? 0) * Number(line.unitCost ?? 0),
    0,
  );
  if (!brandId) {
    return { cost, lines: scopedLines, revenue: Number(sale.totalAmount ?? 0) };
  }
  const allLineValue = lines.reduce(
    (total, line) => total + saleLineAmount(line),
    0,
  );
  const scopedLineValue = scopedLines.reduce(
    (total, line) => total + saleLineAmount(line),
    0,
  );
  return {
    cost,
    lines: scopedLines,
    revenue:
      Number(sale.totalAmount ?? 0) *
      (allLineValue > 0 ? scopedLineValue / allLineValue : 0),
  };
}

export function scopePurchase(order: ReportRecord, brandId: string) {
  const lines = (Array.isArray(order.lines) ? order.lines : []) as ReportRecord[];
  const scopedLines = brandId
    ? lines.filter((line) => line.brandId === brandId)
    : lines;
  if (!scopedLines.length) return null;
  if (!brandId) {
    return {
      amount: Number(order.totalAmount ?? 0),
      paid: Number(order.amountPaid ?? 0),
    };
  }
  const allValue = lines.reduce(
    (total, line) =>
      total + Number(line.quantity ?? 0) * Number(line.unitCost ?? 0),
    0,
  );
  const scopedValue = scopedLines.reduce(
    (total, line) =>
      total + Number(line.quantity ?? 0) * Number(line.unitCost ?? 0),
    0,
  );
  const share = allValue > 0 ? scopedValue / allValue : 0;
  return {
    amount: Number(order.totalAmount ?? 0) * share,
    paid: Number(order.amountPaid ?? 0) * share,
  };
}
