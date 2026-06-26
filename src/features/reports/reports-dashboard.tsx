"use client";

import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission } from "@/lib/permissions";
import { formatCurrency, statusTone, titleCase } from "@/lib/utils";
import { getDashboardMetrics, type DashboardMetrics } from "@/services/dashboard";
import { listOrgRecords } from "@/services/repository";

function countBy(items: Record<string, unknown>[], key: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "notSet");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function toRows(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

async function safeList(organizationId: string, collectionName: "leads" | "propertyUnits" | "tasks") {
  try {
    return await listOrgRecords<Record<string, unknown> & { id: string }>(organizationId, collectionName);
  } catch {
    return [];
  }
}

export function ReportsDashboard() {
  const { activeOrganizationId, member } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [units, setUnits] = useState<Record<string, unknown>[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewReports = hasAnyPermission(member, ["reports.viewFinancial", "dashboard.viewExecutive"]);

  const loadReports = useCallback(async () => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const [nextMetrics, nextLeads, nextUnits, nextTasks] = await Promise.all([
        getDashboardMetrics(activeOrganizationId),
        safeList(activeOrganizationId, "leads"),
        safeList(activeOrganizationId, "propertyUnits"),
        safeList(activeOrganizationId, "tasks"),
      ]);
      setMetrics(nextMetrics);
      setLeads(nextLeads);
      setUnits(nextUnits);
      setTasks(nextTasks);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, canViewReports]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadReports]);

  const leadStatusRows = useMemo(() => toRows(countBy(leads, "status")), [leads]);
  const sourceRows = useMemo(() => toRows(countBy(leads, "source")), [leads]);
  const unitRows = useMemo(() => toRows(countBy(units, "status")), [units]);
  const taskRows = useMemo(() => toRows(countBy(tasks, "status")), [tasks]);
  const estimatedPipeline = useMemo(
    () => leads.reduce((total, item) => total + Number(item.budgetMaximum ?? item.budgetMinimum ?? 0), 0),
    [leads],
  );

  function exportSummary() {
    if (!metrics) {
      return;
    }

    const rows = [
      ["Metric", "Value"],
      ["Total leads", metrics.totalLeads],
      ["Qualified leads", metrics.qualifiedLeads],
      ["Active clients", metrics.activeClients],
      ["Active properties", metrics.activeProperties],
      ["Available units", metrics.availableUnits],
      ["Reserved units", metrics.reservedUnits],
      ["Overdue follow-ups", metrics.overdueFollowUps],
      ["Estimated lead pipeline", estimatedPipeline],
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `beacon-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!canViewReports) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading reports" />;
  }

  if (error || !metrics) {
    return <ErrorState message={error ?? "Unable to load reports."} />;
  }

  const metricCards = [
    ["Total leads", metrics.totalLeads.toLocaleString()],
    ["Qualified leads", metrics.qualifiedLeads.toLocaleString()],
    ["Active clients", metrics.activeClients.toLocaleString()],
    ["Active properties", metrics.activeProperties.toLocaleString()],
    ["Available units", metrics.availableUnits.toLocaleString()],
    ["Reserved units", metrics.reservedUnits.toLocaleString()],
    ["Overdue follow-ups", metrics.overdueFollowUps.toLocaleString()],
    ["Estimated pipeline", formatCurrency(estimatedPipeline)],
  ];

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational reporting from live leads, clients, properties, units, and tasks.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          <Button onClick={loadReports} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportSummary} type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metricCards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="grid gap-2 p-4">
              <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
              <p className="text-xl font-semibold md:text-2xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ["Lead Pipeline", leadStatusRows],
          ["Lead Sources", sourceRows],
          ["Unit Availability", unitRows],
          ["Task Status", taskRows],
        ].map(([title, rows]) => (
          <Card key={title as string}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {title as string}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {(rows as [string, number][]).length ? (rows as [string, number][]).map(([label, value]) => (
                <div className="flex items-center justify-between gap-3 rounded-md border p-3" key={label}>
                  <span className="font-medium">{titleCase(label)}</span>
                  <Badge tone={statusTone(label)}>{value.toLocaleString()}</Badge>
                </div>
              )) : <p className="text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
