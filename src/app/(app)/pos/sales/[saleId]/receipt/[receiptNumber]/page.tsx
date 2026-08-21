import { PosDocumentPage } from "@/features/pos/pos-document-page";

export default async function PosNumberedReceiptPage({ params }: { params: Promise<{ receiptNumber: string; saleId: string }> }) {
  const { receiptNumber, saleId } = await params;
  return <PosDocumentPage receiptNumber={decodeURIComponent(receiptNumber)} saleId={saleId} type="receipt" />;
}
