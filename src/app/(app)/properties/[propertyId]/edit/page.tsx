import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  return <ModuleEditPage config={moduleConfigs.properties} id={propertyId} />;
}
