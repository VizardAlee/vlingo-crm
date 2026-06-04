import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function LeadsPage() {
  return <ModuleListPage config={moduleConfigs.leads} />;
}
