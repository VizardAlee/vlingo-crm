import { PosDocumentPage } from "@/features/pos/pos-document-page";

export default async function PosReceiptPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  return <PosDocumentPage saleId={saleId} type="receipt" />;
}
