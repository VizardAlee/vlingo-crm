import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleListPage } from "@/features/modules/module-pages";

export default function DevelopmentPage() {
  return (
    <ModuleListPage
      config={moduleConfigs.developmentProjects}
      description="Track development projects, contractors, budgets, delivery phases, approvals, and handover readiness."
      title="Development"
    />
  );
}
