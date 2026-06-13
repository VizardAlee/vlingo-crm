import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleEditPage } from "@/features/modules/module-pages";

export default async function EditDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  return <ModuleEditPage config={moduleConfigs.deals} id={dealId} />;
}
