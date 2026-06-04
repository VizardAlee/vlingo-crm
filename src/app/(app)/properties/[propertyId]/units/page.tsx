import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function PropertyUnitsPage() {
  return <ModuleListPage config={moduleConfigs.propertyUnits} />;
}
