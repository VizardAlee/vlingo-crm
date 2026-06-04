import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <ModuleEditPage config={moduleConfigs.leads} id={leadId} />;
}
