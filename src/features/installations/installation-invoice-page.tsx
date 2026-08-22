"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AuthorizedDocumentSignature } from "@/components/authorized-document-signature";
import { PrintAction } from "@/components/print-action";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { nairaAmountInWords } from "@/features/pos/pos-document-utils";
import { hasAnyPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { getOrgRecord } from "@/services/repository";
import type { InstallationInvoice } from "@/types/crm";

export function InstallationInvoicePage({ invoiceId }: { invoiceId: string }) {
  const { activeOrganizationId, member } = useAuth();
  const [invoice, setInvoice] = useState<InstallationInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvoice(await getOrgRecord<InstallationInvoice>(activeOrganizationId, "installationInvoices", invoiceId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load project invoice.");
    } finally { setLoading(false); }
  }, [activeOrganizationId, invoiceId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (!hasAnyPermission(member, ["installations.read", "reports.viewFinancial"])) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading project invoice" />;
  if (error) return <ErrorState message={error} />;
  if (!invoice) return <ErrorState message="Project invoice was not found." />;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary" href={`/installations/${invoice.installationProjectId}`}><ArrowLeft className="h-4 w-4" />Back to project</Link>
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
          <div className="mt-7 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div><h1 className="text-3xl font-black text-[#174f20]">PROJECT INVOICE</h1><p className="mt-2 text-sm font-medium text-[#515851]">{invoice.installationProjectName}</p></div>
            <div className="bg-[#174f20] px-5 py-3 text-xs font-black tracking-[0.12em] text-white">{titleCase(invoice.status).toUpperCase()}</div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <dl className="grid gap-2 rounded-sm border bg-[#f7f7f3] p-4 text-xs"><div><dt className="font-bold uppercase text-[#5e665e]">Invoice number</dt><dd className="mt-1 font-semibold">{invoice.invoiceNumber || invoice.referenceNumber}</dd></div><div><dt className="font-bold uppercase text-[#5e665e]">Invoice date</dt><dd className="mt-1 font-semibold">{formatDate(invoice.issuedAt)}</dd></div><div><dt className="font-bold uppercase text-[#5e665e]">Payment due</dt><dd className="mt-1 font-semibold">{formatDate(invoice.dueAt)}</dd></div></dl>
            <dl className="grid gap-2 rounded-sm border p-4 text-xs"><div><dt className="font-bold uppercase text-[#5e665e]">Bill to</dt><dd className="mt-1 font-semibold">{invoice.clientName}</dd></div>{invoice.clientPhone ? <div><dt className="font-bold uppercase text-[#5e665e]">Telephone</dt><dd className="mt-1">{invoice.clientPhone}</dd></div> : null}<div><dt className="font-bold uppercase text-[#5e665e]">Project site</dt><dd className="mt-1">{invoice.siteAddress}</dd></div></dl>
          </div>
          <section className="mt-6 border-l-[6px] border-[#c7a13a] bg-[#f2f4ed] px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5e665e]">Invoice total</p><p className="mt-1 text-3xl font-black text-[#174f20]">{formatCurrency(invoice.totalAmount)}</p><p className="mt-1 text-xs font-semibold italic">{nairaAmountInWords(invoice.totalAmount)}</p></section>
          <section className="mt-7"><h2 className="border-b-2 border-[#174f20] pb-2 text-xs font-black uppercase tracking-[0.12em] text-[#174f20]">Project billing summary</h2><table className="mt-2 w-full text-xs"><thead className="bg-[#174f20] text-left text-white"><tr><th className="px-3 py-3">Description / milestone</th><th className="px-3 py-3 text-right">Amount</th></tr></thead><tbody><tr className="border-b"><td className="px-3 py-4"><strong>{invoice.description}</strong><p className="mt-1 text-[10px] text-[#697069]">Project {invoice.projectReference}</p></td><td className="px-3 py-4 text-right font-bold">{formatCurrency(invoice.subtotal)}</td></tr><tr><td className="px-3 py-2 text-right font-semibold">Tax</td><td className="px-3 py-2 text-right">{formatCurrency(invoice.taxAmount)}</td></tr><tr className="bg-[#174f20] text-white"><td className="px-3 py-3 text-right font-black">TOTAL</td><td className="px-3 py-3 text-right font-black">{formatCurrency(invoice.totalAmount)}</td></tr></tbody></table></section>
          <section className="mt-7 grid gap-4 sm:grid-cols-2"><div className="border p-4 text-xs"><h2 className="font-black uppercase tracking-[0.1em] text-[#174f20]">Payment information</h2><div className="mt-3 grid gap-1"><p><strong>Account Name:</strong> Vlingo Systems Nig. Ltd.</p><p><strong>Bank:</strong> Lotus Bank</p><p><strong>Account Number:</strong> 1008302826</p><p><strong>Reference:</strong> {invoice.invoiceNumber}</p></div></div>{invoice.notes ? <div className="border p-4 text-xs"><h2 className="font-black uppercase tracking-[0.1em] text-[#174f20]">Note</h2><p className="mt-3 leading-5">{invoice.notes}</p></div> : <div />}</section>
          <footer className="mt-8 grid gap-6 border-t-2 border-[#c7a13a] pt-5 sm:grid-cols-2 sm:items-end"><div><p className="text-[10px] text-[#5e665e]">Prepared by:</p><p className="text-xs font-bold text-[#174f20]">Vlingo Systems Nigeria Limited</p></div><AuthorizedDocumentSignature /></footer>
        </div>
        <div className="bg-[#174f20] px-6 py-2 text-center text-[9px] font-semibold tracking-[0.08em] text-white">Vlingo Systems Nigeria Limited &nbsp;|&nbsp; Solar • Energy • Infrastructure Solutions</div>
      </article>
    </section>
  );
}
