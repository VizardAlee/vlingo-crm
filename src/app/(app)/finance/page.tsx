import { FinanceDashboard } from "@/features/finance/finance-dashboard";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ source?: string | string[] }> }) {
  const { source } = await searchParams;
  return <FinanceDashboard initialSource={Array.isArray(source) ? source[0] : source} />;
}
