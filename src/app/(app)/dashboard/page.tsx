"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ClipboardList, Handshake, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches, hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, statusTone, titleCase } from "@/lib/utils";
import { getDashboardMetrics, type DashboardMetrics } from "@/services/dashboard";

export default function DashboardPage() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canViewDashboard = hasAnyPermission(member, ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll"]);

  useEffect(() => {
    if (!canViewDashboard) {
      return;
    }

    const assignedTo = user && !hasPermission(member, "leads.readAll") ? user.uid : undefined;
    const branchId = canAccessAllBranches(member) ? undefined : activeBranchId || member?.branchId;
    getDashboardMetrics(activeOrganizationId, { assignedTo, branchId })
      .then(setMetrics)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Unable to load dashboard."));
  }, [activeBranchId, activeOrganizationId, canViewDashboard, member, user]);

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
    { icon: BarChart3, label: "Pipeline value", value: formatCurrency(metrics.pipelineValue) },
  ];
  const hasPipelineData = metrics.leadPipeline.some((item) => item.value > 0);
  const hasBusinessPipelineData = metrics.businessPipeline.some((item) => item.value > 0);
  const hasInterestCategoryData = metrics.leadInterestCategories.some((item) => item.value > 0);
  const firstName = String(member?.displayName ?? user?.displayName ?? user?.email ?? "there").trim().split(/\s+/)[0] || "there";
  const canCreateLead = hasPermission(member, "leads.create");
  const canCreateOffering = hasPermission(member, "offerings.create");

  return (
    <section className="grid min-w-0 gap-5 md:gap-6">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Welcome, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational snapshot for {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          {canCreateLead ? <ButtonLink className="h-11 md:h-10" href="/leads/new" variant="secondary">Capture lead</ButtonLink> : null}
          {canCreateOffering ? <ButtonLink className="h-11 md:h-10" href="/offerings/new" variant="outline">Add offering</ButtonLink> : null}
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
                  <Bar dataKey="value" fill="#14550f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-64 place-items-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground md:h-80">No lead pipeline data yet.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Business Pipeline</CardTitle></CardHeader>
          <CardContent className="min-w-0 p-3 md:p-5">
            {hasBusinessPipelineData ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={metrics.businessPipeline.filter((entry) => entry.value > 0)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96}>
                    {metrics.businessPipeline.filter((entry) => entry.value > 0).map((entry) => <Cell fill={entry.color ?? "#14550f"} key={entry.name} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-64 place-items-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground md:h-80">No business pipeline value yet.</div>
            )}
            <div className="mt-4 grid gap-2 text-sm">
              {metrics.businessPipeline.map((item) => (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2" key={item.name}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? "#14550f" }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <strong>{formatCurrency(item.value)}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Operations</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between"><span>Available units</span><strong>{metrics.availableUnits}</strong></div>
            <div className="flex justify-between"><span>Reserved units</span><strong>{metrics.reservedUnits}</strong></div>
            <div className="flex justify-between"><span>Active properties</span><strong>{metrics.activeProperties}</strong></div>
            <div className="flex justify-between"><span>Upcoming inspections</span><strong>{metrics.upcomingInspections}</strong></div>
            <div className="flex justify-between"><span>Overdue follow-ups</span><strong>{metrics.overdueFollowUps}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead Interest Mix</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {hasInterestCategoryData || metrics.leadInterestCategories.length ? metrics.leadInterestCategories.slice(0, 5).map((item) => (
              <div className="flex items-center justify-between gap-3" key={item.name}>
                <span>{item.name}</span>
                <strong>{item.value.toLocaleString()}</strong>
              </div>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No lead categories yet.</div>}
            <p className="text-sm text-muted-foreground">Pipeline value is estimated from open deals first, then lead budgets when deals do not exist yet.</p>
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
