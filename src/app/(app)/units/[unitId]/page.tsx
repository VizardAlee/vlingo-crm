import { ModuleDetailPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function UnitDetailPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <ModuleDetailPage config={moduleConfigs.propertyUnits} id={unitId} />;
}
