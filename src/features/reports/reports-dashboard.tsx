"use client";

import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock3, ContactRound, Download, FileDown, Loader2, MessageSquareText, Sparkles, Target, TrendingUp, UserRound, Users } from "lucide-react";
import { where, type QueryConstraint } from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { effectiveBranchId, hasOrganizationReportAccess } from "@/lib/permissions";
import { formatCurrency, statusTone, titleCase } from "@/lib/utils";
import { getDashboardMetrics, type DashboardMetrics } from "@/services/dashboard";
import { listOrgRecords } from "@/services/repository";

type ReportMode = "personal" | "organization";
type ReportPeriod = "30" | "90" | "365" | "all" | "custom";

interface PersonalReport {
  breakdowns: {
    dealStatus: Record<string, number>;
    leadInteractionType: Record<string, number>;
    leadSource: Record<string, number>;
    leadStatus: Record<string, number>;
    revenueByCategory: Record<string, number>;
    revenueByMonth: Array<{ label: string; value: number }>;
    taskStatus: Record<string, number>;
  };
  generatedAt: string;
  member: { displayName: string; email: string };
  metrics: {
    activeClients: number;
    amountGenerated: number;
    clientCount: number;
    completedTasks: number;
    contactedLeads: number;
    conversionRate: number;
    convertedLeads: number;
    dealCount: number;
    leadCount: number;
    leadInteractions: number;
    pendingRevenue: number;
    pipelineValue: number;
    qualifiedLeads: number;
    taskCompletionRate: number;
    taskCount: number;
    wonDeals: number;
    wonValue: number;
  };
  period: ReportPeriod;
  periodEnd: string | null;
  periodStart: string | null;
  revenueAttributionNote: string;
  timeline: Array<{
    at: string;
    detail: string;
    kind: string;
    leadId: string;
    leadName: string;
    title: string;
  }>;
}

interface ReportLoadOptions {
  from: string;
  includeAi: boolean;
  period: ReportPeriod;
  to: string;
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialReportDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 89);
  return { from: dateInputValue(start), to: dateInputValue(end) };
}

function reportRangeLabel(report: PersonalReport) {
  if (!report.periodStart) return "All time";
  const start = new Date(report.periodStart).toLocaleDateString();
  const end = report.periodEnd ? new Date(report.periodEnd).toLocaleDateString() : new Date().toLocaleDateString();
  return `${start} - ${end}`;
}

function plainText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>*-]+\s*/gm, "")
    .replace(/\*\*|`/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function pdfCurrency(value: number) {
  return `NGN ${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value)}`;
}

async function downloadA4Report(report: PersonalReport, summary: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 16;
  const contentWidth = 210 - margin * 2;
  const pageBottom = 281;
  let y = 16;

  const nextPageIfNeeded = (height = 8) => {
    if (y + height <= pageBottom) return;
    pdf.addPage("a4", "portrait");
    y = 16;
  };
  const heading = (text: string, size = 13) => {
    nextPageIfNeeded(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.text(text, margin, y);
    y += size <= 11 ? 6 : 8;
  };
  const paragraph = (text: string, options: { bold?: boolean; indent?: number } = {}) => {
    const indent = options.indent ?? 0;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(9.5);
    const lines = pdf.splitTextToSize(plainText(text), contentWidth - indent);
    for (const line of lines) {
      nextPageIfNeeded(5);
      pdf.text(line, margin + indent, y);
      y += 4.7;
    }
    y += 1.5;
  };

  pdf.setTextColor(20, 85, 15);
  heading("Vlingo Systems CRM", 16);
  pdf.setTextColor(20, 20, 20);
  heading("Personal Performance Report", 14);
  paragraph(`${report.member.displayName} | ${report.member.email}`, { bold: true });
  paragraph(`Reporting period: ${reportRangeLabel(report)}`);
  paragraph(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);

  heading("AI performance summary");
  paragraph(summary || "AI summary was not available when this report was generated.");

  heading("Key performance indicators");
  [
    ["Assigned leads", report.metrics.leadCount],
    ["Qualified leads", report.metrics.qualifiedLeads],
    ["Converted leads", report.metrics.convertedLeads],
    ["Conversion rate", `${report.metrics.conversionRate.toFixed(1)}%`],
    ["Lead interactions", report.metrics.leadInteractions],
    ["Leads contacted", report.metrics.contactedLeads],
    ["Managed clients", report.metrics.clientCount],
    ["Won deals", report.metrics.wonDeals],
    ["Verified amount generated", pdfCurrency(report.metrics.amountGenerated)],
    ["Pending attributed revenue", pdfCurrency(report.metrics.pendingRevenue)],
    ["Open pipeline", pdfCurrency(report.metrics.pipelineValue)],
    ["Task completion rate", `${report.metrics.taskCompletionRate.toFixed(1)}%`],
  ].forEach(([label, value]) => paragraph(`${label}: ${value}`, { indent: 2 }));

  const breakdown = (title: string, rows: [string, number][], currency = false) => {
    heading(title, 11);
    if (!rows.length) paragraph("No records in this reporting period.");
    rows.forEach(([label, value]) => paragraph(`${titleCase(label)}: ${currency ? pdfCurrency(value) : value.toLocaleString()}`, { indent: 2 }));
  };
  breakdown("Lead status", toRows(report.breakdowns.leadStatus));
  breakdown("Lead interactions", toRows(report.breakdowns.leadInteractionType));
  breakdown("Deal status", toRows(report.breakdowns.dealStatus));
  breakdown("Verified revenue by category", toRows(report.breakdowns.revenueByCategory), true);
  breakdown("Task status", toRows(report.breakdowns.taskStatus));

  heading("Lead interaction timeline");
  if (!report.timeline.length) paragraph("No lead timeline events were recorded in this period.");
  report.timeline.forEach((item) => {
    nextPageIfNeeded(14);
    paragraph(`${new Date(item.at).toLocaleString()} | ${item.leadName} | ${titleCase(item.kind)}`, { bold: true });
    paragraph(`${item.title}: ${item.detail}`, { indent: 2 });
  });
  heading("Revenue attribution note", 10);
  paragraph(report.revenueAttributionNote);

  pdf.save(`vlingo-performance-${report.member.displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

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

async function safeList(organizationId: string, collectionName: "leads" | "tasks", constraints: QueryConstraint[] = []) {
  try {
    return await listOrgRecords<Record<string, unknown> & { id: string }>(organizationId, collectionName, constraints);
  } catch {
    return [];
  }
}

function csvDownload(rows: Array<Array<string | number>>, filename: string) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function BreakdownCard({ rows, title, currency = false }: { rows: [string, number][]; title: string; currency?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {rows.length ? rows.map(([label, value]) => (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border p-3" key={label}>
            <span className="font-medium">{titleCase(label)}</span>
            {currency ? <span className="font-semibold">{formatCurrency(value)}</span> : <Badge tone={statusTone(label)}>{value.toLocaleString()}</Badge>}
          </div>
        )) : <p className="text-muted-foreground">No data in this period.</p>}
      </CardContent>
    </Card>
  );
}

export function ReportsDashboard() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [defaultDates] = useState(() => initialReportDates());
  const [mode, setMode] = useState<ReportMode>("personal");
  const [period, setPeriod] = useState<ReportPeriod>("90");
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [personal, setPersonal] = useState<PersonalReport | null>(null);
  const [aiRequested, setAiRequested] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const automaticLoadKey = useRef("");
  const canViewOrganizationReports = hasOrganizationReportAccess(member);
  const activeMode: ReportMode = canViewOrganizationReports ? mode : "personal";

  const loadReports = useCallback(async ({ from, includeAi, period: requestedPeriod, to }: ReportLoadOptions) => {
    if (!user || !member) return;
    setError(null);
    setLoading(true);
    if (activeMode === "personal" && !includeAi) {
      setAiRequested(false);
      setAiSummary("");
      setAiError(null);
    }
    try {
      if (activeMode === "personal") {
        if (requestedPeriod !== "all" && (!from || !to || from > to)) throw new Error("Choose a valid start and end date before generating the report.");
        const token = await user.getIdToken();
        const params = new URLSearchParams({ organizationId: activeOrganizationId, period: requestedPeriod });
        if (requestedPeriod !== "all") {
          params.set("from", from);
          params.set("to", to);
        }
        const response = await fetch(`/api/reports/personal?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({})) as PersonalReport & { error?: string; requiredAction?: string };
        if (!response.ok) {
          throw new Error([payload.error || "Unable to generate your performance report.", payload.requiredAction].filter(Boolean).join(" "));
        }
        setPersonal(payload);
        setLoading(false);
        setTimelineExpanded(false);
        setTimelineFilter("all");
        if (includeAi) {
          setAiRequested(true);
          setAiSummary("");
          setAiError(null);
          setAiLoading(true);
          try {
            const summaryResponse = await fetch("/api/ai-guide", {
              body: JSON.stringify({
                organizationId: activeOrganizationId,
                question: `Summarize this user's CRM performance report. Base every conclusion only on the aggregate JSON below. Include: an executive overview, lead engagement and follow-up quality, conversion and deal performance, verified revenue and pipeline, task execution, strengths, risks, and 3 practical next actions. Do not invent customer details or compare the user with colleagues.\n\n${JSON.stringify({
                  breakdowns: payload.breakdowns,
                  metrics: payload.metrics,
                  reportingPeriod: { end: payload.periodEnd, start: payload.periodStart },
                  timelineEventTypes: payload.timeline.reduce<Record<string, number>>((totals, item) => {
                    totals[item.kind] = (totals[item.kind] ?? 0) + 1;
                    return totals;
                  }, {}),
                })}`,
              }),
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              method: "POST",
            });
            const summaryPayload = await summaryResponse.json().catch(() => ({})) as { answer?: string; error?: string; requiredAction?: string };
            if (!summaryResponse.ok) throw new Error([summaryPayload.error, summaryPayload.requiredAction].filter(Boolean).join(" ") || "AI summary is unavailable.");
            setAiSummary(summaryPayload.answer ?? "AI summary is unavailable for this report.");
          } catch (summaryError) {
            setAiError(summaryError instanceof Error ? summaryError.message : "AI summary is unavailable.");
          } finally {
            setAiLoading(false);
          }
        }
      } else {
        if (!canViewOrganizationReports) throw new Error("Your role does not include organization-wide reporting.");
        const branchId = effectiveBranchId(member, activeBranchId);
        const branchConstraints = branchId ? [where("branchId", "==", branchId)] : [];
        const [nextMetrics, nextLeads, nextTasks] = await Promise.all([
          getDashboardMetrics(activeOrganizationId, { branchId }),
          safeList(activeOrganizationId, "leads", branchConstraints),
          safeList(activeOrganizationId, "tasks", branchConstraints),
        ]);
        setMetrics(nextMetrics);
        setLeads(nextLeads);
        setTasks(nextTasks);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, activeMode, activeOrganizationId, canViewOrganizationReports, member, user]);

  useEffect(() => {
    const loadKey = `${activeOrganizationId}:${user?.uid ?? "signed-out"}:${activeMode}`;
    if (loading || automaticLoadKey.current === loadKey) return;
    automaticLoadKey.current = loadKey;
    const timeout = window.setTimeout(() => {
      void loadReports({ from: defaultDates.from, includeAi: false, period: "90", to: defaultDates.to });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeMode, activeOrganizationId, defaultDates.from, defaultDates.to, loadReports, loading, user?.uid]);

  function applyPeriod(nextPeriod: ReportPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    if (nextPeriod === "custom") return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Number(nextPeriod) + 1);
    setDateFrom(dateInputValue(start));
    setDateTo(dateInputValue(end));
  }

  async function downloadPdf() {
    if (!personal || downloadingPdf) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      await downloadA4Report(personal, aiSummary);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to generate the PDF report.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const organizationRows = useMemo(() => ({
    leadStatus: toRows(countBy(leads, "status")),
    source: toRows(countBy(leads, "source")),
    task: toRows(countBy(tasks, "status")),
  }), [leads, tasks]);
  const estimatedPipeline = useMemo(() => leads.reduce((total, item) => total + Number(item.budgetMaximum ?? item.budgetMinimum ?? 0), 0), [leads]);

  function exportSummary() {
    if (activeMode === "personal" && personal) {
      const rows: Array<Array<string | number>> = [
        ["Personal performance report", personal.member.displayName],
        ["Email", personal.member.email],
        ["Period", reportRangeLabel(personal)],
        ["AI summary", plainText(aiSummary)],
        ["Metric", "Value"],
        ["Assigned leads", personal.metrics.leadCount],
        ["Qualified leads", personal.metrics.qualifiedLeads],
        ["Converted leads", personal.metrics.convertedLeads],
        ["Lead interactions", personal.metrics.leadInteractions],
        ["Leads contacted", personal.metrics.contactedLeads],
        ["Lead conversion rate", `${personal.metrics.conversionRate.toFixed(1)}%`],
        ["Managed clients", personal.metrics.clientCount],
        ["Owned deals", personal.metrics.dealCount],
        ["Won deals", personal.metrics.wonDeals],
        ["Verified amount generated", personal.metrics.amountGenerated],
        ["Pending attributed revenue", personal.metrics.pendingRevenue],
        ["Open pipeline", personal.metrics.pipelineValue],
        ["Task completion rate", `${personal.metrics.taskCompletionRate.toFixed(1)}%`],
        ...toRows(personal.breakdowns.revenueByCategory).map(([label, value]) => [`Revenue - ${titleCase(label)}`, value]),
        ["Timeline date", "Lead", "Event", "Type", "Details"],
        ...personal.timeline.map((item) => [item.at, item.leadName, item.title, titleCase(item.kind), item.detail]),
      ];
      csvDownload(rows, `vlingo-personal-performance-${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }
    if (!metrics) return;
    csvDownload([
      ["Metric", "Value"],
      ["Total leads", metrics.totalLeads],
      ["Qualified leads", metrics.qualifiedLeads],
      ["Active clients", metrics.activeClients],
      ["Overdue follow-ups", metrics.overdueFollowUps],
      ["Estimated pipeline", metrics.pipelineValue],
    ], `vlingo-organization-report-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const personalCards = personal ? [
    { icon: Users, label: "Assigned leads", value: personal.metrics.leadCount.toLocaleString() },
    { icon: Target, label: "Qualified leads", value: personal.metrics.qualifiedLeads.toLocaleString() },
    { icon: CheckCircle2, label: "Converted leads", value: personal.metrics.convertedLeads.toLocaleString() },
    { icon: MessageSquareText, label: "Lead interactions", value: personal.metrics.leadInteractions.toLocaleString() },
    { icon: ContactRound, label: "Leads contacted", value: personal.metrics.contactedLeads.toLocaleString() },
    { icon: TrendingUp, label: "Conversion rate", value: `${personal.metrics.conversionRate.toFixed(1)}%` },
    { icon: UserRound, label: "Managed clients", value: personal.metrics.clientCount.toLocaleString() },
    { icon: CheckCircle2, label: "Won deals", value: personal.metrics.wonDeals.toLocaleString() },
    { icon: TrendingUp, label: "Verified amount generated", value: formatCurrency(personal.metrics.amountGenerated) },
    { icon: Target, label: "Open pipeline", value: formatCurrency(personal.metrics.pipelineValue) },
  ] : [];
  const organizationCards = metrics ? [
    ["Total leads", metrics.totalLeads.toLocaleString()], ["Qualified leads", metrics.qualifiedLeads.toLocaleString()],
    ["Active clients", metrics.activeClients.toLocaleString()],
    ["Overdue follow-ups", metrics.overdueFollowUps.toLocaleString()], ["Estimated pipeline", formatCurrency(metrics.pipelineValue || estimatedPipeline)],
  ] : [];
  const maxMonthlyRevenue = Math.max(1, ...(personal?.breakdowns.revenueByMonth.map((row) => row.value) ?? []));
  const timelineKinds = Array.from(new Set(personal?.timeline.map((item) => item.kind) ?? [])).sort();
  const filteredTimeline = (personal?.timeline ?? []).filter((item) => timelineFilter === "all" || item.kind === timelineFilter);
  const visibleTimeline = timelineExpanded ? filteredTimeline : filteredTimeline.slice(0, 4);

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Measure assigned work, conversion, pipeline, and verified revenue from live CRM records.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          <Button disabled={activeMode === "personal" ? !personal : !metrics} onClick={exportSummary} type="button" variant="outline"><Download className="h-4 w-4" />CSV</Button>
          {activeMode === "personal" ? <Button disabled={!personal || !aiSummary || downloadingPdf || aiLoading} onClick={() => void downloadPdf()} type="button" variant="secondary">{downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{downloadingPdf ? "Preparing" : "A4 PDF"}</Button> : null}
        </div>
      </div>

      <div className="grid gap-4 border-y bg-white py-4 md:rounded-md md:border md:p-4">
        <div className="inline-flex w-full rounded-md border bg-muted/30 p-1 sm:w-fit">
          <button className={`h-10 flex-1 rounded px-3 text-sm font-medium sm:flex-none ${activeMode === "personal" ? "bg-primary text-primary-foreground" : "hover:bg-white"}`} onClick={() => setMode("personal")} type="button">My performance</button>
          {canViewOrganizationReports ? <button className={`h-10 flex-1 rounded px-3 text-sm font-medium sm:flex-none ${activeMode === "organization" ? "bg-primary text-primary-foreground" : "hover:bg-white"}`} onClick={() => setMode("organization")} type="button">Organization overview</button> : null}
        </div>
        {activeMode === "personal" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_1fr_1fr_auto] lg:items-end">
            <Field label="Quick range">
              <Select className="h-11" value={period} onChange={(event) => applyPeriod(event.target.value as ReportPeriod)}>
                <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All time</option><option value="custom">Custom dates</option>
              </Select>
            </Field>
            <Field label="Start date">
              <Input className="h-11" disabled={period === "all"} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPeriod("custom"); }} type="date" value={dateFrom} />
            </Field>
            <Field label="End date">
              <Input className="h-11" disabled={period === "all"} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPeriod("custom"); }} type="date" value={dateTo} />
            </Field>
            <Button className="h-11 w-full sm:col-span-2 lg:col-span-1 lg:w-auto" disabled={loading || aiLoading} onClick={() => void loadReports({ from: dateFrom, includeAi: true, period, to: dateTo })} type="button">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Generating" : "Generate AI report"}
            </Button>
          </div>
        ) : (
          <Button className="h-11 w-full sm:w-fit" disabled={loading} onClick={() => void loadReports({ from: defaultDates.from, includeAi: false, period: "90", to: defaultDates.to })} type="button">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {loading ? "Refreshing" : "Refresh overview"}
          </Button>
        )}
        {activeMode === "personal" ? <p className="text-xs leading-5 text-muted-foreground">The AI summary uses one AI Guide question from your daily allowance. Only aggregate report figures are sent for summarization.</p> : null}
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Generating report from live CRM data" /> : null}
      {!loading && activeMode === "personal" && !personal ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a date range and generate your personal performance report.</div> : null}
      {!loading && activeMode === "organization" && !metrics ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Generate the organization overview for your current branch scope.</div> : null}

      {activeMode === "personal" && personal ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{personal.member.displayName}</span><span>{personal.member.email}</span><span>{reportRangeLabel(personal)}</span><span>Generated {new Date(personal.generatedAt).toLocaleString()}</span>
          </div>
          {aiRequested ? <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI report summary</CardTitle></CardHeader>
            <CardContent>
              {aiLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyzing your report...</div> : null}
              {!aiLoading && aiSummary ? <MarkdownContent className="text-sm leading-6" content={aiSummary} /> : null}
              {!aiLoading && aiError ? <ErrorState message={`The report was generated, but its AI summary was unavailable. ${aiError}`} /> : null}
            </CardContent>
          </Card> : null}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {personalCards.map(({ icon: Icon, label, value }) => <Card key={label}><CardContent className="grid gap-2 p-4"><Icon className="h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground md:text-sm">{label}</p><p className="break-all text-xl font-semibold md:text-2xl">{value}</p></CardContent></Card>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard rows={toRows(personal.breakdowns.leadStatus)} title="Lead performance" />
            <BreakdownCard rows={toRows(personal.breakdowns.dealStatus)} title="Deal performance" />
            <BreakdownCard rows={toRows(personal.breakdowns.leadSource)} title="Lead sources" />
            <BreakdownCard rows={toRows(personal.breakdowns.leadInteractionType)} title="Lead interactions" />
            <BreakdownCard currency rows={toRows(personal.breakdowns.revenueByCategory)} title="Verified revenue by category" />
            <BreakdownCard rows={toRows(personal.breakdowns.taskStatus)} title="Task performance" />
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Verified revenue trend</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {personal.breakdowns.revenueByMonth.map((row) => <div className="grid grid-cols-[4rem_minmax(2rem,1fr)_minmax(4.5rem,6rem)] items-center gap-2 text-sm" key={row.label}><span className="text-xs text-muted-foreground sm:text-sm">{row.label}</span><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.max(row.value ? 4 : 0, (row.value / maxMonthlyRevenue) * 100)}%` }} /></div><span className="break-all text-right text-xs font-semibold sm:text-sm">{formatCurrency(row.value)}</span></div>)}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />Lead interaction timeline</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Interactions, stage changes, captured leads, and follow-up tasks.</p>
              </div>
              {timelineKinds.length ? (
                <Select aria-label="Filter timeline" className="h-10 w-full sm:w-44" onChange={(event) => { setTimelineFilter(event.target.value); setTimelineExpanded(false); }} value={timelineFilter}>
                  <option value="all">All events ({personal.timeline.length})</option>
                  {timelineKinds.map((kind) => <option key={kind} value={kind}>{titleCase(kind)}</option>)}
                </Select>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className={timelineExpanded ? "grid max-h-[28rem] gap-2 overflow-y-auto pr-1" : "grid gap-2"}>
              {visibleTimeline.length ? visibleTimeline.map((item, index) => (
                <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2 border-l-2 border-primary/30 py-1.5 pl-3" key={`${item.at}-${item.kind}-${item.leadId}-${index}`}>
                  <div className="text-[11px] leading-4 text-muted-foreground">
                    <p>{new Date(item.at).toLocaleDateString([], { day: "2-digit", month: "short" })}</p>
                    <p>{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link className="truncate text-sm font-semibold text-primary hover:underline" href={`/leads/${item.leadId}`}>{item.leadName}</Link>
                      <Badge className="shrink-0" tone="muted">{titleCase(item.kind)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No lead interactions or timeline events were recorded in this period.</p>}
              </div>
              {filteredTimeline.length > 4 ? (
                <Button className="w-full sm:w-fit" onClick={() => setTimelineExpanded((current) => !current)} size="sm" type="button" variant="outline">
                  {timelineExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {timelineExpanded ? "Show less" : `Show all ${filteredTimeline.length} events`}
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <p className="rounded-md border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">{personal.revenueAttributionNote}</p>
        </>
      ) : null}

      {activeMode === "organization" && metrics ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{organizationCards.map(([label, value]) => <Card key={label}><CardContent className="grid gap-2 p-4"><p className="text-xs text-muted-foreground md:text-sm">{label}</p><p className="break-all text-xl font-semibold md:text-2xl">{value}</p></CardContent></Card>)}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard rows={organizationRows.leadStatus} title="Lead pipeline" /><BreakdownCard rows={organizationRows.source} title="Lead sources" />
            <BreakdownCard rows={metrics.businessPipeline.map((item) => [item.name, item.value])} title="Business pipeline value" /><BreakdownCard rows={metrics.leadInterestCategories.map((item) => [item.name, item.value])} title="Lead interest mix" />
            <BreakdownCard rows={organizationRows.task} title="Task status" />
          </div>
        </>
      ) : null}
    </section>
  );
}
