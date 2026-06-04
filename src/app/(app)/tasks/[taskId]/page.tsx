import { ModuleDetailPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <ModuleDetailPage config={moduleConfigs.tasks} id={taskId} />;
}
