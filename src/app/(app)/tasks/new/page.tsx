import { ModuleCreatePage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function NewTaskPage() {
  return <ModuleCreatePage config={moduleConfigs.tasks} />;
}
