import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleListPage } from "@/features/modules/module-pages";

export default function RentalsPage() {
  return <ModuleListPage config={moduleConfigs.rentalTenancies} />;
}
