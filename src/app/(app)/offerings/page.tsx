import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default function OfferingsPage() {
  return <ModuleListPage config={moduleConfigs.offerings} />;
}
