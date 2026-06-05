import { Building, ClipboardList, HardHat, Milestone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const developmentSections = [
  { description: "Development pipeline, phases, delivery dates, and project status.", icon: Building, title: "Projects" },
  { description: "Contractor profiles, assigned scope, and contract status.", icon: HardHat, title: "Contractors" },
  { description: "Milestones for approvals, construction, inspections, and handover.", icon: Milestone, title: "Milestones" },
  { description: "Internal project tasks and owner follow-ups.", icon: ClipboardList, title: "Project Tasks" },
];

export default function DevelopmentPage() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Development</h1>
        <p className="mt-1 text-sm text-muted-foreground">Projects, contractors, milestones, and development delivery tracking.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {developmentSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardContent className="grid gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{section.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle>Development Workspace</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Prepared route for development project and contractor management.</CardContent>
      </Card>
    </section>
  );
}
