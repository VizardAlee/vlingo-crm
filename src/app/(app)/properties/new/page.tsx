import { ModuleCreatePage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function NewPropertyPage() {
  return <ModuleCreatePage config={moduleConfigs.properties} />;
}
