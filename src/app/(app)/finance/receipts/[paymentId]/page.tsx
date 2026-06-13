import { FinanceReceiptPage } from "@/features/finance/finance-receipt-page";

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <FinanceReceiptPage paymentId={paymentId} />;
}
