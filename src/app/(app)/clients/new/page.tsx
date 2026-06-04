import { ModuleCreatePage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function NewClientPage() {
  return <ModuleCreatePage config={moduleConfigs.clients} />;
}
