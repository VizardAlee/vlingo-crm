import { ModuleDetailPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function ActivityDetailPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <ModuleDetailPage config={moduleConfigs.activities} id={activityId} />;
}
