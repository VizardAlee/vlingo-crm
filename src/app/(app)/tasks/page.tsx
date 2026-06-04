import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function TasksPage() {
  return <ModuleListPage config={moduleConfigs.tasks} />;
}
