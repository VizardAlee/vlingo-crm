import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleDetailPage } from "@/features/modules/module-pages";

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  return <ModuleDetailPage config={moduleConfigs.deals} id={dealId} />;
}
