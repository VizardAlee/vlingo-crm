"use client";

import {
  Banknote,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Download,
  FileDown,
  Loader2,
  PackageCheck,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches } from "@/lib/permissions";
import { formatCurrency, titleCase } from "@/lib/utils";
import { listOrganizationBranches } from "@/services/branches";
import { listInventoryBrands } from "@/services/inventory";
import type { Branch, InventoryBrand } from "@/types/crm";
import type {
  OrganizationReport,
  ReportBreakdownRow,
} from "@/features/reports/organization-report-types";
import { safeCsvCell } from "@/features/reports/organization-report-utils";

type ReportSection =
  | "executive"
  | "sales"
  | "inventory"
  | "purchasing"
  | "projects"
  | "finance"
  | "crm";

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 89);
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function downloadCsv(rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(safeCsvCell).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `vlingo-inventory-and-operations-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(report: OrganizationReport) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 15;
  const width = 180;
  let y = 16;
  const ensureSpace = (height = 8) => {
    if (y + height < 282) return;
    pdf.addPage("a4", "portrait");
    y = 16;
  };
  const heading = (text: string, size = 12) => {
    ensureSpace(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.text(text, margin, y);
    y += size > 12 ? 8 : 6;
  };
  const row = (label: string, value: string | number) => {
    ensureSpace(6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(value), margin + width, y, { align: "right" });
    y += 5;
  };
  const paragraph = (text: string) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(text, width);
    const height = Math.max(5, lines.length * 4);
    ensureSpace(height);
    pdf.text(lines, margin, y);
    y += height;
  };
  const section = (
    title: string,
    rows: Array<[string, string | number]>,
  ) => {
    y += 3;
    heading(title);
    rows.forEach(([label, value]) => row(label, value));
  };
  const pdfCurrency = (value: number) =>
    `NGN ${new Intl.NumberFormat("en-NG", {
      maximumFractionDigits: 2,
    }).format(value)}`;
  const table = (
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    columnWidths: number[],
  ) => {
    y += 3;
    heading(title);
    const drawHeader = () => {
      ensureSpace(9);
      pdf.setFillColor(20, 100, 60);
      pdf.setDrawColor(30, 30, 30);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      let x = margin;
      headers.forEach((header, index) => {
        pdf.rect(x, y, columnWidths[index], 7, "FD");
        pdf.text(header, x + 1.5, y + 4.6);
        x += columnWidths[index];
      });
      pdf.setTextColor(20, 20, 20);
      y += 7;
    };
    drawHeader();
    const displayRows = rows.length ? rows : [["No records in this scope."]];
    displayRows.forEach((values) => {
      const cellLines = headers.map((_, index) =>
        pdf.splitTextToSize(
          String(values[index] ?? ""),
          Math.max(4, columnWidths[index] - 3),
        ),
      );
      const height = Math.max(7, ...cellLines.map((lines) => lines.length * 3.4 + 3));
      if (y + height >= 282) {
        pdf.addPage("a4", "portrait");
        y = 16;
        heading(`${title} (continued)`, 10);
        drawHeader();
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setDrawColor(120, 125, 120);
      let x = margin;
      headers.forEach((_, index) => {
        pdf.rect(x, y, columnWidths[index], height);
        pdf.text(cellLines[index], x + 1.5, y + 4.2);
        x += columnWidths[index];
      });
      y += height;
    });
  };

  const reportDate = (value: string) =>
    value
      ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Not recorded";
  const quantity = (value: number, unit = "unit") =>
    `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value)} ${unit}`;

  pdf.setTextColor(25, 105, 60);
  heading("VLINGO SYSTEMS NIGERIA LIMITED", 16);
  pdf.setTextColor(30, 75, 120);
  heading("INVENTORY REPORT", 15);
  pdf.setTextColor(20, 20, 20);
  row("Scope", report.scopeLabel);
  row(
    "Reporting period",
    `${reportDate(report.filters.dateFrom)} to ${reportDate(report.filters.dateTo)}`,
  );
  row("Generated", new Date(report.generatedAt).toLocaleString());
  y += 2;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(9);
  pdf.text(
    "Opening stock, receipts, sales, transfers and reconciled closing balances",
    margin,
    y,
  );
  y += 7;
  table(
    `1. Opening stock position - ${reportDate(report.filters.dateFrom)}`,
    ["Product / SKU", "Brand", "Opening quantity"],
    report.rows.inventoryOpeningStock.map((item) => [
      `${item.label}${item.sku ? ` / ${item.sku}` : ""}`,
      item.brand,
      quantity(item.openingQuantity, item.unitOfMeasure),
    ]),
    [90, 45, 45],
  );
  table(
    "2. Stock received during the period",
    ["Date", "Product", "Type", "Reference / source", "Quantity"],
    report.rows.inventoryReceipts.map((item) => [
      reportDate(item.date),
      item.label,
      titleCase(item.type),
      `${item.referenceNumber}${item.source ? ` / ${item.source}` : ""}`,
      quantity(item.quantity, item.unitOfMeasure),
    ]),
    [25, 55, 24, 51, 25],
  );
  table(
    "3. Inventory sales movements and selling prices",
    ["Date", "Salesperson", "Product", "Invoice", "Qty", "Unit price", "Line total"],
    report.rows.inventorySales.map((item) => [
      reportDate(item.date),
      item.salesperson,
      item.label,
      item.referenceNumber,
      item.quantity,
      item.unitPrice === null ? "Not recorded" : pdfCurrency(item.unitPrice),
      item.lineTotal === null ? "Not recorded" : pdfCurrency(item.lineTotal),
    ]),
    [22, 24, 43, 28, 11, 25, 27],
  );
  table(
    "4. Internal stock transfers",
    ["Date", "Product", "Source", "Destination", "Qty", "Reference"],
    report.rows.inventoryTransfers.map((item) => [
      reportDate(item.date),
      item.label,
      item.source,
      item.destination,
      quantity(item.quantity, item.unitOfMeasure),
      item.referenceNumber,
    ]),
    [24, 48, 31, 31, 20, 26],
  );
  table(
    `5. Closing inventory position - ${reportDate(report.filters.dateTo)}`,
    ["Product", "Opening", "Reconciliation", "Closing"],
    report.rows.inventoryReconciliation.map((item) => [
      item.label,
      quantity(item.openingQuantity, item.unitOfMeasure),
      `${item.openingQuantity} + ${item.receipts} received + ${item.transferIn} transferred in + ${item.adjustmentIn} other in - ${item.sales} sold - ${item.transferOut} transferred out - ${item.adjustmentOut} other out`,
      quantity(item.closingQuantity, item.unitOfMeasure),
    ]),
    [55, 28, 69, 28],
  );
  section("6. Inventory summary", [
    ["Opening quantity", report.summary.inventoryOpeningQuantity],
    ["Stock received", report.summary.inventoryReceivedQuantity],
    ["Units sold", report.summary.inventorySoldQuantity],
    ["Transfers in", report.summary.inventoryTransferredIn],
    ["Transfers out", report.summary.inventoryTransferredOut],
    ["Other stock in", report.summary.inventoryAdjustmentIn],
    ["Other stock out", report.summary.inventoryAdjustmentOut],
    ["Closing quantity", report.summary.inventoryClosingQuantity],
    ["Sales revenue", pdfCurrency(report.summary.salesRevenue)],
    ["Current inventory value", pdfCurrency(report.summary.inventoryValue)],
  ]);
  y += 3;
  heading("7. Notes and calculation basis");
  report.limitations.forEach((item, index) =>
    paragraph(`${index + 1}. ${item}`),
  );
  table(
    "Appendix A. Current stock position by item",
    ["Item / SKU", "Brand", "On hand", "Reserved", "Available", "Reorder / status", "Value"],
    report.rows.inventoryItems.map((item) => [
      `${item.label}${item.sku ? ` / ${item.sku}` : ""}`,
      item.brand,
      item.onHand,
      item.reserved,
      item.available,
      `${item.reorderLevel ?? "-"} / ${titleCase(item.status)}`,
      pdfCurrency(item.stockValue),
    ]),
    [42, 27, 18, 18, 18, 29, 28],
  );
  table(
    "Appendix B. Current stock position by location",
    ["Location", "Branch", "Items", "On hand", "Available", "Value"],
    report.rows.inventoryLocations.map((location) => [
      location.label,
      location.branch,
      location.itemCount,
      location.onHand,
      location.available,
      pdfCurrency(location.stockValue),
    ]),
    [38, 36, 20, 24, 24, 38],
  );
  table(
    `Appendix C. Full movement ledger (${report.filters.dateFrom} to ${report.filters.dateTo})`,
    ["Date", "Reference", "Type", "Item", "From > To", "Qty"],
    report.rows.inventoryMovements.map((movement) => [
      movement.occurredAt
        ? new Date(movement.occurredAt).toLocaleDateString()
        : "-",
      movement.referenceNumber,
      titleCase(movement.type),
      movement.label,
      `${movement.source} > ${movement.destination}`,
      movement.quantity,
    ]),
    [23, 33, 23, 39, 45, 17],
  );
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(20, 100, 60);
    pdf.text(
      `VLINGO SYSTEMS NIGERIA LTD | INVENTORY REPORT | ${page} of ${pageCount}`,
      105,
      292,
      { align: "center" },
    );
  }
  pdf.save(
    `vlingo-inventory-report-${report.filters.dateFrom}-to-${report.filters.dateTo}.pdf`,
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="grid gap-2 p-4">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Breakdown({
  currency = false,
  rows,
  title,
}: {
  currency?: boolean;
  rows: ReportBreakdownRow[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.length ? (
          rows.map((row) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              key={row.label}
            >
              <span>{titleCase(row.label)}</span>
              <strong>{currency ? formatCurrency(row.value) : row.value.toLocaleString()}</strong>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No activity in this period.</p>
        )}
      </CardContent>
    </Card>
  );
}

const sections: Array<{ id: ReportSection; label: string }> = [
  { id: "sales", label: "Sales" },
  { id: "executive", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "purchasing", label: "Purchasing" },
  { id: "projects", label: "Projects" },
  { id: "finance", label: "Finance" },
  { id: "crm", label: "CRM pipeline" },
];

export function OrganizationReports() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [dates] = useState(initialDates);
  const [dateFrom, setDateFrom] = useState(dates.from);
  const [dateTo, setDateTo] = useState(dates.to);
  const [branchId, setBranchId] = useState(activeBranchId);
  const [brandId, setBrandId] = useState("all");
  const [section, setSection] = useState<ReportSection>("sales");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [report, setReport] = useState<OrganizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "pdf" | null>(null);
  const allBranchAccess = canAccessAllBranches(member);

  useEffect(() => {
    const timeout = window.setTimeout(() => setBranchId(activeBranchId), 0);
    return () => window.clearTimeout(timeout);
  }, [activeBranchId]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void Promise.all([
        listOrganizationBranches(activeOrganizationId),
        listInventoryBrands(activeOrganizationId, member),
      ])
        .then(([nextBranches, nextBrands]) => {
          if (!active) return;
          setBranches(nextBranches.filter((item) => item.status === "active"));
          setBrands(nextBrands);
        })
        .catch((nextError: unknown) => {
          if (!active) return;
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load report filters.",
          );
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [activeOrganizationId, member]);

  const load = useCallback(async () => {
    if (!user || !member) return;
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setError("Choose a valid report start and end date.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        branchId,
        brandId,
        from: dateFrom,
        organizationId: activeOrganizationId,
        to: dateTo,
      });
      const response = await fetch(`/api/reports/organization?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as
        | OrganizationReport
        | { error?: string };
      if (!response.ok || !("summary" in payload))
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to generate the organization report.",
        );
      setReport(payload);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to generate the organization report.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, branchId, brandId, dateFrom, dateTo, member, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const csvRows = useMemo<Array<Array<string | number>>>(() => {
    if (!report) return [];
    return [
      ["Vlingo consolidated organization report"],
      ["Scope", report.scopeLabel],
      ["Period", report.filters.dateFrom, report.filters.dateTo],
      ...report.limitations.map((item) => ["Report note", item]),
      ["Metric", "Value"],
      ...Object.entries(report.summary).map(([label, value]) => [
        titleCase(label),
        value,
      ]),
      [],
      ["1. Opening stock position"],
      ["Product", "Brand", "SKU", "Unit", "Opening quantity"],
      ...report.rows.inventoryOpeningStock.map((row) => [
        row.label,
        row.brand,
        row.sku,
        row.unitOfMeasure,
        row.openingQuantity,
      ]),
      [],
      ["2. Stock received during the period"],
      ["Date", "Product", "Type", "Reference", "Source", "Quantity", "Unit"],
      ...report.rows.inventoryReceipts.map((row) => [
        row.date,
        row.label,
        row.type,
        row.referenceNumber,
        row.source,
        row.quantity,
        row.unitOfMeasure,
      ]),
      [],
      ["3. Inventory sales movements and selling prices"],
      ["Date", "Salesperson", "Customer", "Product", "Invoice", "Quantity", "Unit price", "Line total"],
      ...report.rows.inventorySales.map((row) => [
        row.date,
        row.salesperson,
        row.customer,
        row.label,
        row.referenceNumber,
        row.quantity,
        row.unitPrice ?? "",
        row.lineTotal ?? "",
      ]),
      [],
      ["4. Internal stock transfers"],
      ["Date", "Product", "Source", "Destination", "Quantity", "Unit", "Reference"],
      ...report.rows.inventoryTransfers.map((row) => [
        row.date,
        row.label,
        row.source,
        row.destination,
        row.quantity,
        row.unitOfMeasure,
        row.referenceNumber,
      ]),
      [],
      ["5. Closing inventory reconciliation"],
      ["Product", "Brand", "SKU", "Opening", "Received", "Sold", "Transfer in", "Transfer out", "Other in", "Other out", "Closing"],
      ...report.rows.inventoryReconciliation.map((row) => [
        row.label,
        row.brand,
        row.sku,
        row.openingQuantity,
        row.receipts,
        row.sales,
        row.transferIn,
        row.transferOut,
        row.adjustmentIn,
        row.adjustmentOut,
        row.closingQuantity,
      ]),
      [],
      ["Top product", "Quantity", "Revenue"],
      ...report.rows.topProducts.map((row) => [row.label, row.quantity, row.revenue]),
      [],
      [
        "Inventory item",
        "Brand",
        "SKU",
        "Category",
        "Unit",
        "On hand",
        "Reserved",
        "Available",
        "Reorder level",
        "Status",
        "Unit cost",
        "Stock value",
      ],
      ...report.rows.inventoryItems.map((row) => [
        row.label,
        row.brand,
        row.sku,
        row.category,
        row.unitOfMeasure,
        row.onHand,
        row.reserved,
        row.available,
        row.reorderLevel ?? "",
        row.status,
        row.costPrice,
        row.stockValue,
      ]),
      [],
      ["Location", "Branch", "Products", "On hand", "Reserved", "Available", "Low stock", "Stock value"],
      ...report.rows.inventoryLocations.map((row) => [
        row.label,
        row.branch,
        row.itemCount,
        row.onHand,
        row.reserved,
        row.available,
        row.lowStockItems,
        row.stockValue,
      ]),
      [],
      ["Movement date", "Reference", "Type", "Purpose", "Product", "Source", "Destination", "Quantity"],
      ...report.rows.inventoryMovements.map((row) => [
        row.occurredAt,
        row.referenceNumber,
        row.type,
        row.purpose,
        row.label,
        row.source,
        row.destination,
        row.quantity,
      ]),
      [],
      ["Supplier", "Order value", "Paid", "Outstanding"],
      ...report.rows.suppliers.map((row) => [
        row.label,
        row.orderValue,
        row.paid,
        row.outstanding,
      ]),
      [],
      ["Project", "Status", "Contract value", "Estimated cost", "Margin"],
      ...report.rows.projects.map((row) => [
        row.label,
        titleCase(row.status),
        row.contractValue,
        row.estimatedCost,
        row.margin,
      ]),
      [],
      ["Branch", "Sales", "Cash collected", "Inventory units", "Purchases"],
      ...report.rows.branches.map((row) => [
        row.label,
        row.salesRevenue,
        row.cashCollected,
        row.inventoryOnHand,
        row.purchaseValue,
      ]),
    ];
  }, [report]);

  async function exportPdf() {
    if (!report || downloading) return;
    setDownloading("pdf");
    try {
      await downloadPdf(report);
    } finally {
      setDownloading(null);
    }
  }

  function exportCsv() {
    if (!report || downloading) return;
    setDownloading("csv");
    downloadCsv(csvRows);
    setDownloading(null);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-md border bg-white p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <Field label="Start date">
          <Input
            max={dateTo}
            onChange={(event) => setDateFrom(event.target.value)}
            type="date"
            value={dateFrom}
          />
        </Field>
        <Field label="End date">
          <Input
            min={dateFrom}
            onChange={(event) => setDateTo(event.target.value)}
            type="date"
            value={dateTo}
          />
        </Field>
        <Field label="Branch">
          <Select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
            {allBranchAccess ? <option value="all">All branches</option> : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Brand">
          <Select onChange={(event) => setBrandId(event.target.value)} value={brandId}>
            <option value="all">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button disabled={loading} onClick={() => void load()} type="button">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          Generate
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((item) => (
          <Button
            key={item.id}
            onClick={() => setSection(item.id)}
            size="sm"
            type="button"
            variant={section === item.id ? "primary" : "outline"}
          >
            {item.label}
          </Button>
        ))}
        <div className="flex-1" />
        <Button disabled={!report || Boolean(downloading)} onClick={exportCsv} size="sm" type="button" variant="outline">
          <Download className="h-4 w-4" /> CSV
        </Button>
        <Button disabled={!report || Boolean(downloading)} onClick={() => void exportPdf()} size="sm" type="button" variant="secondary">
          {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} A4 PDF
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Calculating live organization reports" /> : null}
      {!loading && report ? (
        <>
          <p className="text-xs text-muted-foreground">
            {report.scopeLabel} · {report.filters.dateFrom} to {report.filters.dateTo} · Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
          {report.limitations.length ? (
            <div className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {report.limitations.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
          {section === "executive" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={ShoppingCart} label="Sales revenue" value={formatCurrency(report.summary.salesRevenue)} />
                <MetricCard icon={Banknote} label="Cash collected" value={formatCurrency(report.summary.cashCollected)} />
                <MetricCard icon={ShoppingCart} label="Sales transactions" value={report.summary.salesCount} />
                <MetricCard icon={PackageCheck} label="Units sold" value={report.summary.unitsSold.toLocaleString()} />
                <MetricCard icon={Receipt} label="Outstanding invoices" value={formatCurrency(report.summary.outstandingSales)} />
                <MetricCard icon={TrendingUp} label="POS gross profit" value={formatCurrency(report.summary.grossProfit)} />
                <MetricCard icon={Boxes} label="Available stock" value={report.summary.inventoryAvailable.toLocaleString()} />
                <MetricCard icon={Receipt} label="Supplier balance" value={formatCurrency(report.summary.purchaseOutstanding)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Breakdown currency rows={report.breakdowns.salesByBrand} title="Sales by brand" />
                <Breakdown rows={report.breakdowns.inventoryByBrand} title="Inventory units by brand" />
              </div>
            </>
          ) : null}

          {section === "sales" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <MetricCard icon={ShoppingCart} label="Sales transactions" value={report.summary.salesCount} />
                <MetricCard icon={PackageCheck} label="Units sold" value={report.summary.unitsSold.toLocaleString()} />
                <MetricCard icon={TrendingUp} label="Sales revenue" value={formatCurrency(report.summary.salesRevenue)} />
                <MetricCard icon={Receipt} label="Outstanding invoices" value={formatCurrency(report.summary.outstandingSales)} />
                <MetricCard icon={Banknote} label="POS gross profit" value={formatCurrency(report.summary.grossProfit)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Breakdown currency rows={report.breakdowns.salesByBrand} title="Sales by brand" />
                <Breakdown currency rows={report.breakdowns.documentBrandSales} title="Sales document identity" />
              </div>
              <DataTable
                headers={["Product", "Quantity", "Revenue"]}
                rows={report.rows.topProducts.map((row) => [row.label, row.quantity.toLocaleString(), formatCurrency(row.revenue)])}
                title="Top-selling products"
              />
              <DataTable
                headers={["Branch", "Sales", "Cash", "Units in stock", "Purchases"]}
                rows={report.rows.branches.map((row) => [row.label, formatCurrency(row.salesRevenue), formatCurrency(row.cashCollected), row.inventoryOnHand.toLocaleString(), formatCurrency(row.purchaseValue)])}
                title="Sales performance by branch"
              />
            </>
          ) : null}

          {section === "inventory" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={Boxes} label="Opening quantity" value={report.summary.inventoryOpeningQuantity.toLocaleString()} />
                <MetricCard icon={PackageCheck} label="Stock received" value={report.summary.inventoryReceivedQuantity.toLocaleString()} />
                <MetricCard icon={ShoppingCart} label="Units sold" value={report.summary.inventorySoldQuantity.toLocaleString()} />
                <MetricCard icon={Boxes} label="Closing quantity" value={report.summary.inventoryClosingQuantity.toLocaleString()} />
                <MetricCard icon={TrendingUp} label="Transfers out" value={report.summary.inventoryTransferredOut.toLocaleString()} />
                <MetricCard icon={TrendingUp} label="Other stock movements" value={(report.summary.inventoryAdjustmentIn + report.summary.inventoryAdjustmentOut).toLocaleString()} />
                <MetricCard icon={Banknote} label="Sales revenue" value={formatCurrency(report.summary.salesRevenue)} />
                <MetricCard icon={Banknote} label="Current stock value" value={formatCurrency(report.summary.inventoryValue)} />
              </div>
              <DataTable
                headers={["Product", "Brand", "SKU", "Unit", "Opening quantity"]}
                rows={report.rows.inventoryOpeningStock.map((row) => [
                  row.label,
                  row.brand,
                  row.sku || "-",
                  row.unitOfMeasure,
                  row.openingQuantity.toLocaleString(),
                ])}
                title={`1. Opening stock position - ${new Date(`${report.filters.dateFrom}T12:00:00`).toLocaleDateString()}`}
              />
              <DataTable
                headers={["Date", "Product", "Type", "Reference", "Source / note", "Quantity"]}
                rows={report.rows.inventoryReceipts.map((row) => [
                  row.date ? new Date(row.date).toLocaleDateString() : "-",
                  row.label,
                  titleCase(row.type),
                  row.referenceNumber,
                  row.source || "Direct receipt",
                  `${row.quantity.toLocaleString()} ${row.unitOfMeasure}`,
                ])}
                title="2. Stock received during the period"
              />
              <DataTable
                headers={["Date", "Salesperson", "Customer", "Product", "Invoice", "Qty", "Unit price", "Line total"]}
                rows={report.rows.inventorySales.map((row) => [
                  row.date ? new Date(row.date).toLocaleDateString() : "-",
                  row.salesperson,
                  row.customer,
                  row.label,
                  row.referenceNumber,
                  row.quantity.toLocaleString(),
                  row.unitPrice === null ? "Not recorded" : formatCurrency(row.unitPrice),
                  row.lineTotal === null ? "Not recorded" : formatCurrency(row.lineTotal),
                ])}
                title="3. Inventory sales movements and selling prices"
              />
              <DataTable
                headers={["Date", "Product", "Source", "Destination", "Quantity", "Reference"]}
                rows={report.rows.inventoryTransfers.map((row) => [
                  row.date ? new Date(row.date).toLocaleDateString() : "-",
                  row.label,
                  row.source,
                  row.destination,
                  `${row.quantity.toLocaleString()} ${row.unitOfMeasure}`,
                  row.referenceNumber,
                ])}
                title="4. Internal stock transfers"
              />
              <DataTable
                headers={["Product", "Opening", "Received", "Sold", "Transfer in", "Transfer out", "Other in", "Other out", "Closing"]}
                rows={report.rows.inventoryReconciliation.map((row) => [
                  row.label,
                  row.openingQuantity.toLocaleString(),
                  row.receipts.toLocaleString(),
                  row.sales.toLocaleString(),
                  row.transferIn.toLocaleString(),
                  row.transferOut.toLocaleString(),
                  row.adjustmentIn.toLocaleString(),
                  row.adjustmentOut.toLocaleString(),
                  row.closingQuantity.toLocaleString(),
                ])}
                title={`5. Closing inventory reconciliation - ${new Date(`${report.filters.dateTo}T12:00:00`).toLocaleDateString()}`}
              />
              <div className="grid gap-4 lg:grid-cols-3">
                <Breakdown rows={report.breakdowns.inventoryByBrand} title="6. Current units by brand" />
                <Breakdown currency rows={report.breakdowns.inventoryValueByBrand} title="Current inventory value by brand" />
                <Breakdown rows={report.breakdowns.inventoryMovementsByType} title="Period movements by type" />
              </div>
              <Card>
                <CardHeader><CardTitle>7. Notes and calculation basis</CardTitle></CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  {report.limitations.map((item, index) => (
                    <p key={item}><strong>{index + 1}.</strong> {item}</p>
                  ))}
                </CardContent>
              </Card>
              <DataTable
                headers={["Product", "Brand", "SKU", "On hand", "Reserved", "Available", "Reorder", "Status", "Stock value"]}
                rows={report.rows.inventoryItems.map((row) => [row.label, row.brand, row.sku || "-", row.onHand.toLocaleString(), row.reserved.toLocaleString(), row.available.toLocaleString(), row.reorderLevel?.toLocaleString() ?? "-", titleCase(row.status), formatCurrency(row.stockValue)])}
                title="Appendix A. Current stock position"
              />
              <DataTable
                headers={["Location", "Branch", "Products", "On hand", "Reserved", "Available", "Low stock", "Stock value"]}
                rows={report.rows.inventoryLocations.map((row) => [row.label, row.branch, row.itemCount.toLocaleString(), row.onHand.toLocaleString(), row.reserved.toLocaleString(), row.available.toLocaleString(), row.lowStockItems.toLocaleString(), formatCurrency(row.stockValue)])}
                title="Appendix B. Current stock position by location"
              />
              <DataTable
                headers={["Date", "Reference", "Type", "Purpose", "Product", "Source", "Destination", "Quantity"]}
                rows={report.rows.inventoryMovements.map((row) => [row.occurredAt ? new Date(row.occurredAt).toLocaleDateString() : "-", row.referenceNumber, titleCase(row.type), titleCase(row.purpose), row.label, row.source, row.destination, row.quantity.toLocaleString()])}
                title="Appendix C. Full movement ledger"
              />
            </>
          ) : null}

          {section === "purchasing" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={Receipt} label="Purchase orders" value={report.summary.purchaseCount} />
                <MetricCard icon={ShoppingCart} label="Purchase value" value={formatCurrency(report.summary.purchaseValue)} />
                <MetricCard icon={Banknote} label="Supplier balance" value={formatCurrency(report.summary.purchaseOutstanding)} />
                <MetricCard icon={Receipt} label="Overdue balance" value={formatCurrency(report.summary.overdueSupplierBalance)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Breakdown currency rows={report.breakdowns.purchasePaymentStatus} title="Purchases by payment status" />
                <Breakdown rows={report.breakdowns.purchaseReceivingStatus} title="Orders by receiving status" />
              </div>
              <DataTable
                headers={["Supplier", "Order value", "Paid", "Outstanding"]}
                rows={report.rows.suppliers.map((row) => [row.label, formatCurrency(row.orderValue), formatCurrency(row.paid), formatCurrency(row.outstanding)])}
                title="Supplier exposure"
              />
            </>
          ) : null}

          {section === "projects" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={BriefcaseBusiness} label="Contract value" value={formatCurrency(report.summary.projectContractValue)} />
                <MetricCard icon={Receipt} label="Estimated cost" value={formatCurrency(report.summary.projectEstimatedCost)} />
                <MetricCard icon={TrendingUp} label="Estimated margin" value={formatCurrency(report.summary.projectEstimatedMargin)} />
                <MetricCard icon={PackageCheck} label="Completed projects" value={report.summary.completedProjects} />
              </div>
              <Breakdown rows={report.breakdowns.projectStatus} title="Project status" />
              <DataTable
                headers={["Project", "Status", "Contract", "Estimated cost", "Margin"]}
                rows={report.rows.projects.map((row) => [row.label, titleCase(row.status), formatCurrency(row.contractValue), formatCurrency(row.estimatedCost), formatCurrency(row.margin)])}
                title="Installation project profitability"
              />
            </>
          ) : null}

          {section === "finance" ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard icon={Banknote} label="Verified cash collected" value={formatCurrency(report.summary.cashCollected)} />
              <MetricCard icon={Receipt} label="Recognized expenses" value={formatCurrency(report.summary.financeExpenses)} />
              <MetricCard icon={Receipt} label="Paid expenses" value={formatCurrency(report.summary.paidExpenses)} />
              <MetricCard icon={TrendingUp} label="Net cash flow" value={formatCurrency(report.summary.netCashFlow)} />
            </div>
          ) : null}

          {section === "crm" ? (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                <MetricCard icon={Users} label="Active clients" value={report.summary.activeClients} />
                <MetricCard icon={TrendingUp} label="Open pipeline" value={formatCurrency(report.summary.openPipelineValue)} />
                <MetricCard icon={Building2} label="Branches in scope" value={report.rows.branches.length} />
                <MetricCard icon={PackageCheck} label="Completed tasks" value={report.summary.completedTasks} />
              </div>
              <Breakdown rows={report.breakdowns.crmStatus} title="Lead status" />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  title,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b">
              {headers.map((header) => (
                <th className="p-3 text-xs uppercase text-muted-foreground" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-b last:border-0" key={`${row[0]}-${index}`}>
                {row.map((value, cellIndex) => (
                  <td className="p-3" key={`${cellIndex}-${value}`}>
                    {cellIndex === 1 && typeof value === "string" && !value.includes("₦") ? (
                      <Badge tone="muted">{value}</Badge>
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={headers.length}>
                  No records in this reporting period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
