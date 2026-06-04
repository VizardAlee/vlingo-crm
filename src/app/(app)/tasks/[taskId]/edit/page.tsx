import { ModuleEditPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <ModuleEditPage config={moduleConfigs.tasks} id={taskId} />;
}
