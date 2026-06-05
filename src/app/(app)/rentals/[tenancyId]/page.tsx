import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleDetailPage } from "@/features/modules/module-pages";

export default async function RentalDetailPage({ params }: { params: Promise<{ tenancyId: string }> }) {
  const { tenancyId } = await params;
  return <ModuleDetailPage config={moduleConfigs.rentalTenancies} id={tenancyId} />;
}
