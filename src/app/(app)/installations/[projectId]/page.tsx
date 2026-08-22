import { InstallationProjectDetailPage } from "@/features/installations/installation-projects";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <InstallationProjectDetailPage id={projectId} />;
}
