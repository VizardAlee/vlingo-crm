import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleEditPage } from "@/features/modules/module-pages";

export default async function EditDevelopmentProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ModuleEditPage config={moduleConfigs.developmentProjects} id={projectId} />;
}
