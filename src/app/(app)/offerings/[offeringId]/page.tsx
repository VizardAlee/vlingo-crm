import { ModuleDetailPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function OfferingDetailPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <ModuleDetailPage config={moduleConfigs.offerings} id={offeringId} />;
}
