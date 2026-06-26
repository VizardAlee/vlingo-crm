"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ClipboardList, Handshake, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, statusTone, titleCase } from "@/lib/utils";
import { getDashboardMetrics, type DashboardMetrics } from "@/services/dashboard";

export default function DashboardPage() {
  const { activeOrganizationId, member, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canViewDashboard = hasAnyPermission(member, ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll"]);

  useEffect(() => {
    if (!canViewDashboard) {
      return;
    }

    const assignedTo = user && !hasPermission(member, "leads.readAll") ? user.uid : undefined;
    getDashboardMetrics(activeOrganizationId, { assignedTo })
      .then(setMetrics)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Unable to load dashboard."));
  }, [activeOrganizationId, canViewDashboard, member, user]);

  if (!canViewDashboard) {
    return <PermissionDenied />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!metrics) {
    return <LoadingState label="Loading dashboard metrics" />;
  }

  const cards = [
    { icon: Users, label: "Total leads", value: metrics.totalLeads.toLocaleString() },
    { icon: ClipboardList, label: "Qualified leads", value: metrics.qualifiedLeads.toLocaleString() },
    { icon: Handshake, label: "Active deals", value: metrics.activeDeals.toLocaleString() },
    { icon: CalendarClock, label: "Overdue follow-ups", value: metrics.overdueFollowUps.toLocaleString() },
  ];
  const hasPipelineData = metrics.leadPipeline.some((item) => item.value > 0);
  const hasSourceData = metrics.leadSources.some((item) => item.value > 0);

  return (
    <section className="grid min-w-0 gap-5 md:gap-6">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational snapshot for {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          <ButtonLink className="h-11 md:h-10" href="/leads/new" variant="secondary">Capture lead</ButtonLink>
          <ButtonLink className="h-11 md:h-10" href="/properties/new" variant="outline">List property</ButtonLink>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="grid gap-3 p-4 md:flex md:items-center md:gap-4 md:p-5">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary md:h-11 md:w-11">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground md:text-sm">{card.label}</p>
                  <p className="text-xl font-semibold md:text-2xl">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader><CardTitle>Lead Pipeline</CardTitle></CardHeader>
          <CardContent className="min-w-0 p-3 md:p-5">
            {hasPipelineData ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.leadPipeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#b11226" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-64 place-items-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground md:h-80">No lead pipeline data yet.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
          <CardContent className="min-w-0 p-3 md:p-5">
            {hasSourceData ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={metrics.leadSources} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96}>
                    {metrics.leadSources.map((entry) => <Cell fill={entry.color ?? "#b11226"} key={entry.name} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-64 place-items-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground md:h-80">No lead source data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Property Availability</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between"><span>Available units</span><strong>{metrics.availableUnits}</strong></div>
            <div className="flex justify-between"><span>Reserved units</span><strong>{metrics.reservedUnits}</strong></div>
            <div className="flex justify-between"><span>Active properties</span><strong>{metrics.activeProperties}</strong></div>
            <div className="flex justify-between"><span>Upcoming inspections</span><strong>{metrics.upcomingInspections}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pipeline Value</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(metrics.pipelineValue)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Estimated from open lead budgets in the current accessible pipeline.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {metrics.recentActivities.length ? metrics.recentActivities.map((activity) => (
              <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={activity.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{activity.subject}</span>
                  <Badge tone={statusTone(activity.type)}>{titleCase(activity.type)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{activity.at ? formatDate(activity.at) : "Date not set"}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No recent activities yet.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
