import { InstallationInvoicePage } from "@/features/installations/installation-invoice-page";

export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <InstallationInvoicePage invoiceId={invoiceId} />;
}
