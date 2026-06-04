import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <ModuleEditPage config={moduleConfigs.propertyUnits} id={unitId} />;
}
