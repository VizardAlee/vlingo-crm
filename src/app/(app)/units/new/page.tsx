import { ModuleCreatePage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function NewUnitPage() {
  return <ModuleCreatePage config={moduleConfigs.propertyUnits} />;
}
