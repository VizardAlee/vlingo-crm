import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function ActivitiesPage() {
  return <ModuleListPage config={moduleConfigs.activities} />;
}
