import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleCreatePage } from "@/features/modules/module-pages";

export default function NewDealPage() {
  return <ModuleCreatePage config={moduleConfigs.deals} />;
}
