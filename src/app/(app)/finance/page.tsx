import { FinanceDashboard } from "@/features/finance/finance-dashboard";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ relatedEntityId?: string | string[]; relatedEntityType?: string | string[]; source?: string | string[] }> }) {
  const { relatedEntityId, relatedEntityType, source } = await searchParams;
  return <FinanceDashboard initialRelatedEntityId={Array.isArray(relatedEntityId) ? relatedEntityId[0] : relatedEntityId} initialRelatedEntityType={Array.isArray(relatedEntityType) ? relatedEntityType[0] : relatedEntityType} initialSource={Array.isArray(source) ? source[0] : source} />;
}
