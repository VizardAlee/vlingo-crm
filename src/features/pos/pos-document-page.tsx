"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PrintAction } from "@/components/print-action";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { AuthorizedDocumentSignature } from "@/components/authorized-document-signature";
import { useAuth } from "@/features/auth/auth-provider";
import { nairaAmountInWords } from "@/features/pos/pos-document-utils";
import { hasPermission } from "@/lib/permissions";
import { formatDate, titleCase } from "@/lib/utils";
import { getOrgRecord } from "@/services/repository";
import type { PosPaymentEntry, PosSale } from "@/types/crm";

const officialCurrency = new Intl.NumberFormat("en-NG", {
  currency: "NGN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

function formatMoney(value: number) {
  return officialCurrency.format(Number(value || 0));
}

function documentDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatDate(value.toDate() as Date);
  }
  return formatDate(value as Date | string | undefined);
}

function validityDate(value: unknown) {
  const source = value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate() as Date
    : new Date(String(value));
  if (Number.isNaN(source.getTime())) return "14 days";
  source.setDate(source.getDate() + 14);
  return documentDate(source);
}

function paymentStatusLabel(status: PosSale["paymentStatus"]) {
  if (status === "paid") return "PAID IN FULL";
  if (status === "partPaid") return "PART PAYMENT";
  return "PENDING PAYMENT";
}

function receiptFor(sale: PosSale, receiptNumber?: string) {
  return (sale.paymentHistory ?? []).find((entry) => entry.receiptNumber === receiptNumber)
    ?? (sale.paymentHistory ?? []).at(-1);
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[8.5rem_1fr] gap-3 border-b border-black/10 py-2 last:border-0"><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5e665e]">{label}</dt><dd className="break-words text-xs font-semibold text-[#151915]">{value}</dd></div>;
}

function Totals({ sale, receipt }: { sale: PosSale; receipt?: PosPaymentEntry }) {
  return (
    <div className="ml-auto grid w-full max-w-sm text-xs">
      <div className="flex justify-between border-b py-2"><span>Subtotal</span><span>{formatMoney(sale.subtotal)}</span></div>
      <div className="flex justify-between border-b py-2"><span>Discount</span><span>-{formatMoney(sale.discountAmount)}</span></div>
      <div className="flex justify-between border-b py-2"><span>Tax ({sale.taxRate}%)</span><span>{formatMoney(sale.taxAmount)}</span></div>
      <div className="flex justify-between bg-[#174f20] px-3 py-2.5 text-sm font-bold text-white"><span>{receipt ? "TOTAL RECEIVED" : "INVOICE TOTAL"}</span><span>{formatMoney(receipt?.amount ?? sale.totalAmount)}</span></div>
      {receipt && sale.balanceDue > 0 ? <div className="flex justify-between border-b px-3 py-2"><span>Invoice balance</span><strong>{formatMoney(sale.balanceDue)}</strong></div> : null}
    </div>
  );
}

export function PosDocumentPage({ receiptNumber, saleId, type }: { receiptNumber?: string; saleId: string; type: "invoice" | "receipt" }) {
  const { activeOrganizationId, member } = useAuth();
  const [sale, setSale] = useState<PosSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSale(await getOrgRecord<PosSale>(activeOrganizationId, "posSales", saleId));
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
  if (type === "receipt" && !sale.receiptNumber) return <ErrorState message="No payment receipt exists for this sale yet." />;

  const receipt = type === "receipt" ? receiptFor(sale, receiptNumber) : undefined;
  const documentNumber = type === "invoice" ? sale.invoiceNumber : receipt?.receiptNumber ?? sale.receiptNumber ?? "Receipt";
  const amount = receipt?.amount ?? (sale.balanceDue > 0 ? sale.balanceDue : sale.totalAmount);
  const amountLabel = type === "receipt" ? "Total received" : sale.balanceDue > 0 ? "Amount due" : "Invoice total";
  const branchLabel = titleCase(sale.branchId || "Kaduna");
  const statusLabel = paymentStatusLabel(sale.paymentStatus);

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary" href="/pos"><ArrowLeft className="h-4 w-4" />Back to Point of Sale</Link>
        <PrintAction />
      </div>

      <article className="pos-print-document mx-auto w-full max-w-[850px] overflow-hidden bg-white text-[#151915] shadow-xl print:shadow-none">
        <div className="h-2 bg-[#174f20]" />
        <div className="pos-document-body px-6 py-6 sm:px-10 sm:py-8">
          <header className="border-b-2 border-[#c7a13a] pb-4">
            <Image alt="Vlingo Systems Nigeria Limited" className="h-auto w-full max-w-[520px] object-contain object-left" height={92} priority src="/branding/vlingo-logo.jpeg" width={550} />
            <div className="pos-document-letterhead mt-3 grid gap-2 text-[10px] font-medium leading-4 text-[#4f574f] sm:grid-cols-2 sm:gap-5">
              <p><strong className="text-[#174f20]">Kaduna Office:</strong> 27A, Isa Kaita Road, U/Sarki, Kaduna · +234 803 770 1084</p>
              <p><strong className="text-[#174f20]">Kano Office:</strong> Block 3, Shop 1D, Civic Center Ultramodern Market, Kano · 07032545288</p>
            </div>
          </header>

          <div className="pos-document-title mt-7 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div><h1 className="text-2xl font-black tracking-tight text-[#174f20] sm:text-3xl">{type === "invoice" ? "SALES INVOICE" : "OFFICIAL RECEIPT"}</h1><p className="mt-2 max-w-xl text-sm font-medium text-[#515851]">{sale.lines.map((line) => line.offeringName).slice(0, 3).join(" • ")}{sale.lines.length > 3 ? ` • +${sale.lines.length - 3} more` : ""}</p></div>
            <div className="w-fit min-w-40 bg-[#174f20] px-5 py-3 text-center text-xs font-black tracking-[0.12em] text-white">{type === "receipt" ? "PAYMENT RECEIVED" : statusLabel}</div>
          </div>

          <div className="pos-document-meta mt-6 grid gap-5 sm:grid-cols-2">
            <dl className="rounded-sm border border-black/10 bg-[#f7f7f3] px-4 py-1">
              <MetaItem label={type === "invoice" ? "Invoice number" : "Receipt number"} value={documentNumber} />
              <MetaItem label={type === "invoice" ? "Invoice date" : "Receipt date"} value={documentDate(receipt?.at ?? sale.soldAt)} />
              {type === "invoice" ? <MetaItem label="Validity" value={`14 Days · ${validityDate(sale.soldAt)}`} /> : <MetaItem label="Payment method" value={titleCase(receipt?.method ?? sale.paymentMethod ?? "Not recorded")} />}
              <MetaItem label="Payment status" value={statusLabel} />
            </dl>
            <dl className="rounded-sm border border-black/10 px-4 py-1">
              <MetaItem label={type === "invoice" ? "Bill to" : "Received from"} value={sale.customerName || "Walk-in customer"} />
              {sale.customerPhone ? <MetaItem label="Telephone" value={sale.customerPhone} /> : null}
              {sale.customerEmail ? <MetaItem label="Email" value={sale.customerEmail} /> : null}
              <MetaItem label="Location" value={sale.customerAddress || branchLabel} />
            </dl>
          </div>

          <section className="mt-6 grid gap-1 border-l-[6px] border-[#c7a13a] bg-[#f2f4ed] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5e665e]">{amountLabel}</p>
            <p className="text-2xl font-black text-[#174f20] sm:text-3xl">{formatMoney(amount)}</p>
            <p className="text-xs font-semibold italic text-[#3e463e]">{nairaAmountInWords(amount)}</p>
          </section>

          <section className="mt-7">
            <h2 className="border-b-2 border-[#174f20] pb-2 text-xs font-black uppercase tracking-[0.12em] text-[#174f20]">{type === "invoice" ? "Itemized invoice summary" : "Itemized payment summary"}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="bg-[#174f20] text-left text-[10px] uppercase tracking-[0.08em] text-white"><tr><th className="w-12 px-3 py-3 text-center">S/N</th><th className="px-3 py-3">Item / Service Description</th><th className="px-3 py-3 text-center">Qty.</th><th className="px-3 py-3 text-right">Unit Price</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
                <tbody>{sale.lines.map((line, index) => <tr className="border-b border-black/10 even:bg-[#fafaf7]" key={line.offeringId}><td className="px-3 py-3 text-center">{index + 1}</td><td className="px-3 py-3"><strong>{line.offeringName}</strong><p className="mt-0.5 text-[10px] text-[#697069]">{line.brandName}{line.sku ? ` · SKU ${line.sku}` : ""}{line.discountAmount ? ` · Discount ${formatMoney(line.discountAmount)}` : ""}</p></td><td className="px-3 py-3 text-center">{line.quantity}</td><td className="px-3 py-3 text-right">{formatMoney(line.unitPrice)}</td><td className="px-3 py-3 text-right font-bold">{formatMoney(line.lineTotal)}</td></tr>)}</tbody>
              </table>
            </div>
            <Totals receipt={receipt} sale={sale} />
          </section>

          {type === "invoice" ? (
            <section className="pos-document-payment-grid mt-7 grid gap-4 sm:grid-cols-2">
              <div className="border border-black/10 p-4"><h2 className="text-xs font-black uppercase tracking-[0.1em] text-[#174f20]">Payment information</h2><div className="mt-3 grid gap-1 text-xs"><p><strong>Account Name:</strong> Vlingo Systems Nig. Ltd.</p><p><strong>Bank:</strong> Lotus Bank</p><p><strong>Account Number:</strong> 1008302826</p><p><strong>Reference:</strong> {sale.invoiceNumber}</p></div></div>
              <div className="border border-black/10 p-4"><h2 className="text-xs font-black uppercase tracking-[0.1em] text-[#174f20]">Payment summary</h2><div className="mt-3 grid gap-1 text-xs"><p><strong>Amount paid:</strong> {formatMoney(sale.amountPaid)}</p><p><strong>Balance due:</strong> {formatMoney(sale.balanceDue)}</p><p><strong>Status:</strong> {statusLabel}</p></div></div>
            </section>
          ) : (
            <section className="mt-7 border border-black/10 p-4"><h2 className="text-xs font-black uppercase tracking-[0.1em] text-[#174f20]">Payment acknowledgement</h2><p className="mt-3 text-xs leading-5 text-[#3f463f]">This receipt confirms that Vlingo Systems Nigeria Limited received {formatMoney(receipt?.amount ?? sale.amountPaid)} from {sale.customerName || "the customer"} by {titleCase(receipt?.method ?? sale.paymentMethod ?? "the recorded payment method")} on {documentDate(receipt?.at ?? sale.soldAt)} for the items listed above. Payment reference: {receipt?.paymentReference || sale.paymentReference || "Not provided"}.</p></section>
          )}

          {sale.notes ? <section className="mt-5 bg-[#f7f7f3] p-4 text-xs leading-5"><strong className="text-[#174f20]">NOTE:</strong> {sale.notes}</section> : null}

          {type === "invoice" ? <section className="mt-5 text-[10px] leading-5 text-[#4f574f]"><h2 className="font-black uppercase tracking-[0.1em] text-[#174f20]">Terms</h2><ul className="mt-1 list-disc pl-4"><li>This invoice is valid for 14 days from the invoice date.</li><li>Prices and availability may be reviewed after the validity period.</li><li>Payment must use the invoice number as its transaction reference.</li><li>Product warranties remain subject to the applicable manufacturer or supplier conditions.</li></ul></section> : null}

          <footer className="pos-document-signoff mt-8 grid gap-6 border-t-2 border-[#c7a13a] pt-5 sm:grid-cols-2 sm:items-end">
            <div><p className="text-[10px] text-[#5e665e]">Prepared by:</p><p className="text-xs font-bold text-[#174f20]">Vlingo Systems Nigeria Limited</p></div>
            {type === "receipt" ? <AuthorizedDocumentSignature /> : null}
          </footer>
        </div>
        <div className="bg-[#174f20] px-6 py-2 text-center text-[9px] font-semibold tracking-[0.08em] text-white sm:px-10">Vlingo Systems Nigeria Limited &nbsp;|&nbsp; Solar • Energy • Infrastructure Solutions</div>
      </article>
    </section>
  );
}
