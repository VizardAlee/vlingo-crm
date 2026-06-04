import { ModuleDetailPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ModuleDetailPage config={moduleConfigs.clients} id={clientId} />;
}
