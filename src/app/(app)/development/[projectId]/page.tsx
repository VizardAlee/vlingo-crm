import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleDetailPage } from "@/features/modules/module-pages";

export default async function DevelopmentProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ModuleDetailPage config={moduleConfigs.developmentProjects} id={projectId} />;
}
