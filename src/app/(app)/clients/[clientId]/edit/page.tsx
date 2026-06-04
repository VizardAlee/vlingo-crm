import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ModuleEditPage config={moduleConfigs.clients} id={clientId} />;
}
