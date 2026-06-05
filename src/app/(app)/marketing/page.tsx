import { ChartNoAxesColumnIncreasing, Megaphone, Network, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const marketingSections = [
  { description: "Public listing readiness, media status, and marketing channels.", icon: Tags, title: "Listings" },
  { description: "Campaign plans for social, property portals, referrals, and events.", icon: Megaphone, title: "Campaigns" },
  { description: "Agent and broker contribution to leads, inspections, and conversions.", icon: Network, title: "Agents" },
  { description: "Source performance, qualified leads, and conversion movement.", icon: ChartNoAxesColumnIncreasing, title: "Performance" },
];

export default function MarketingPage() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Listings, campaigns, lead sources, agents, and acquisition reporting.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {marketingSections.map((section) => {
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
        <CardHeader><CardTitle>Marketing Workspace</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Prepared route for listing campaigns, lead sources, and agent performance.</CardContent>
      </Card>
    </section>
  );
}
