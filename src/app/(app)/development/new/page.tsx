import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleCreatePage } from "@/features/modules/module-pages";

export default function NewDevelopmentProjectPage() {
  return <ModuleCreatePage config={moduleConfigs.developmentProjects} />;
}
