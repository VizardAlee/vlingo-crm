import { ModuleCreatePage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function NewLeadPage() {
  return <ModuleCreatePage config={moduleConfigs.leads} />;
}
