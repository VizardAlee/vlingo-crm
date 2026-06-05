import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleEditPage } from "@/features/modules/module-pages";

export default async function EditRentalPage({ params }: { params: Promise<{ tenancyId: string }> }) {
  const { tenancyId } = await params;
  return <ModuleEditPage config={moduleConfigs.rentalTenancies} id={tenancyId} />;
}
