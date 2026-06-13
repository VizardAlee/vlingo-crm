import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleListPage } from "@/features/modules/module-pages";

export default function DealsPage() {
  return <ModuleListPage config={moduleConfigs.deals} />;
}
