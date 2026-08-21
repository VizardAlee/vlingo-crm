"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { getOrganization, type OrganizationRecord } from "@/services/organization";
import { getOrgRecord } from "@/services/repository";
import type { PosSale } from "@/types/crm";

function documentDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatDate(value.toDate() as Date);
  }
  return formatDate(value as Date | string | undefined);
}

export function PosDocumentPage({ receiptNumber, saleId, type }: { receiptNumber?: string; saleId: string; type: "invoice" | "receipt" }) {
  const { activeOrganizationId, member } = useAuth();
  const [sale, setSale] = useState<PosSale | null>(null);
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSale, nextOrganization] = await Promise.all([
        getOrgRecord<PosSale>(activeOrganizationId, "posSales", saleId),
        getOrganization(activeOrganizationId),
      ]);
      setSale(nextSale);
      setOrganization(nextOrganization);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load sales document.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, saleId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (!hasPermission(member, "pos.read")) return <PermissionDenied />;
  if (loading) return <LoadingState label={`Loading ${type}`} />;
  if (error) return <ErrorState message={error} />;
  if (!sale) return <ErrorState message="Sale was not found." />;
  if (type === "receipt" && !sale.receiptNumber) return <ErrorState message="No payment receipt exists for this sale yet. Open the invoice to record a payment." />;

  const receipt = type === "receipt"
    ? (sale.paymentHistory ?? []).find((entry) => entry.receiptNumber === receiptNumber) ?? (sale.paymentHistory ?? []).at(-1)
    : undefined;
  const documentNumber = type === "invoice" ? sale.invoiceNumber : receipt?.receiptNumber ?? sale.receiptNumber;
  const amountHeading = type === "invoice" ? "Invoice total" : "Payment received";

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary" href="/pos"><ArrowLeft className="h-4 w-4" />Back to Point of Sale</Link>
        <Button onClick={() => window.print()} type="button"><Printer className="h-4 w-4" />Print {type}</Button>
      </div>
      <Card className="mx-auto w-full max-w-4xl print:border-0 print:shadow-none">
        <CardContent className="grid gap-7 p-6 sm:p-9">
          <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-lg font-semibold">{organization?.legalName || organization?.name || "Vlingo Systems Nig. Ltd."}</p>
              <p className="mt-1 text-sm text-muted-foreground">Sales {type}</p>
            </div>
            <div className="sm:text-right"><p className="text-xs font-semibold uppercase text-muted-foreground">{type}</p><h1 className="mt-1 text-2xl font-semibold">{documentNumber}</h1><p className="mt-1 text-xs text-muted-foreground">Sale {sale.referenceNumber}</p></div>
          </header>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase text-muted-foreground">Bill to</p><p className="mt-2 font-semibold">{sale.customerName}</p>{sale.customerPhone ? <p className="text-sm text-muted-foreground">{sale.customerPhone}</p> : null}{sale.customerEmail ? <p className="text-sm text-muted-foreground">{sale.customerEmail}</p> : null}{sale.customerAddress ? <p className="mt-1 text-sm text-muted-foreground">{sale.customerAddress}</p> : null}</div>
            <div className="sm:text-right"><p className="text-xs font-semibold uppercase text-muted-foreground">{amountHeading}</p><p className="mt-2 text-3xl font-semibold">{formatCurrency(type === "invoice" ? sale.totalAmount : receipt?.amount ?? sale.amountPaid)}</p><p className="mt-1 text-sm text-muted-foreground">{documentDate(type === "receipt" ? receipt?.at ?? sale.soldAt : sale.soldAt)}</p><Badge className="mt-2" tone={sale.paymentStatus === "paid" ? "success" : sale.paymentStatus === "partPaid" ? "warning" : "danger"}>{titleCase(sale.paymentStatus)}</Badge></div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{sale.lines.map((line) => <tr className="border-t" key={line.offeringId}><td className="px-4 py-3"><strong>{line.offeringName}</strong><p className="text-xs text-muted-foreground">{line.brandName} · {line.sku || "No SKU"}</p></td><td className="px-4 py-3">{line.quantity}</td><td className="px-4 py-3 text-right">{formatCurrency(line.unitPrice)}</td><td className="px-4 py-3 text-right">{formatCurrency(line.discountAmount)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(line.lineTotal)}</td></tr>)}</tbody></table>
          </div>
          <div className="ml-auto grid w-full max-w-sm gap-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(sale.discountAmount)}</span></div><div className="flex justify-between"><span>Tax ({sale.taxRate}%)</span><span>{formatCurrency(sale.taxAmount)}</span></div><div className="flex justify-between border-t pt-2 text-lg"><strong>Total</strong><strong>{formatCurrency(sale.totalAmount)}</strong></div><div className="flex justify-between"><span>Paid</span><strong>{formatCurrency(sale.amountPaid)}</strong></div><div className="flex justify-between"><span>Balance due</span><strong>{formatCurrency(sale.balanceDue)}</strong></div></div>
          {type === "receipt" && receipt ? <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2"><div><strong>Payment method</strong><p className="mt-1 text-muted-foreground">{titleCase(receipt.method)}</p></div><div><strong>Payment reference</strong><p className="mt-1 text-muted-foreground">{receipt.paymentReference || "Not provided"}</p></div></div> : null}
          {sale.notes ? <div className="rounded-md border bg-muted/30 p-4 text-sm"><strong>Notes</strong><p className="mt-1 text-muted-foreground">{sale.notes}</p></div> : null}
          <footer className="border-t pt-5 text-xs text-muted-foreground">Generated from Vlingo CRM Point of Sale. Stock was deducted from the selling branch when this transaction was completed.</footer>
        </CardContent>
      </Card>
    </section>
  );
}
