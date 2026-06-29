import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditOfferingPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <ModuleEditPage config={moduleConfigs.offerings} id={offeringId} />;
}
