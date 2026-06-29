"use client";

import { collection, getCountFromServer, getDocs, limit, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { orgCollectionPath } from "@/services/firestore-paths";

export interface DashboardChartPoint {
  color?: string;
  name: string;
  value: number;
}

export interface DashboardActivity {
  id: string;
  at: string;
  subject: string;
  type: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  activeClients: number;
  activeProperties: number;
  availableUnits: number;
  reservedUnits: number;
  activeDeals: number;
  pipelineValue: number;
  upcomingInspections: number;
  overdueFollowUps: number;
  leadPipeline: DashboardChartPoint[];
  leadSources: DashboardChartPoint[];
  recentActivities: DashboardActivity[];
}

const pipelineStages = [
  { key: "new", name: "New" },
  { key: "qualified", name: "Qualified" },
  { key: "inspectionScheduled", name: "Inspection" },
  { key: "negotiation", name: "Negotiation" },
  { key: "converted", name: "Converted" },
];

const sourceColors = ["#b11226", "#202124", "#047857", "#2563eb", "#7c3aed", "#c2410c"];
const activeDealStatuses = ["qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending"];
const activeRealDealStatuses = [...activeDealStatuses, "new"];
const openPipelineStatuses = [...activeDealStatuses, "new", "contacted"];

function logQueryError(context: string, error: unknown) {
  console.error(`[Firestore query failed] ${context}`, error);
}

async function count(path: string, filters: QueryConstraint[] = []) {
  if (!db) {
    return 0;
  }

  try {
    const snapshot = await getCountFromServer(query(collection(db, path), where("isDeleted", "==", false), ...filters));
    return snapshot.data().count;
  } catch (error) {
    logQueryError(`count:${path}`, error);
    return 0;
  }
}

async function listRecords(path: string, filters: QueryConstraint[] = [], max = 100) {
  if (!db) {
    return [];
  }

  try {
    const snapshot = await getDocs(query(collection(db, path), where("isDeleted", "==", false), ...filters, limit(max)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Record<string, unknown> & { id: string });
  } catch (error) {
    logQueryError(`list:${path}`, error);
    return [];
  }
}

async function listRecentActivities(organizationId: string, filters: QueryConstraint[] = []) {
  if (!db) {
    return [];
  }

  try {
    const snapshot = await getDocs(query(
      collection(db, orgCollectionPath(organizationId, "activities")),
      where("isDeleted", "==", false),
      ...filters,
      orderBy("updatedAt", "desc"),
      limit(5),
    ));
    return snapshot.docs.map((item) => {
      const data = item.data();
      const updatedAt = data.updatedAt;
      return {
        id: item.id,
        at: typeof updatedAt === "object" && updatedAt && "toDate" in updatedAt && typeof updatedAt.toDate === "function"
          ? (updatedAt.toDate() as Date).toISOString()
          : String(updatedAt ?? ""),
        subject: String(data.subject ?? "Activity"),
        type: String(data.type ?? "activity"),
      };
    });
  } catch (error) {
    logQueryError(`recent-activities:${organizationId}`, error);
    return [];
  }
}

function countRows(rows: Record<string, unknown>[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? "Not set").trim() || "Not set";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function topSources(rows: Record<string, unknown>[]) {
  return Object.entries(countRows(rows, "source"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], index) => ({ color: sourceColors[index % sourceColors.length], name, value }));
}

function pipelineValue(rows: Record<string, unknown>[]) {
  return rows
    .filter((row) => openPipelineStatuses.includes(String(row.status ?? "")))
    .reduce((total, row) => total + Number(row.budgetMaximum ?? row.budgetMinimum ?? 0), 0);
}

function dealPipelineValue(rows: Record<string, unknown>[]) {
  return rows
    .filter((row) => activeRealDealStatuses.includes(String(row.status ?? "")))
    .reduce((total, row) => total + Number(row.agreedAmount ?? row.offerAmount ?? row.depositAmount ?? row.reservationAmount ?? 0), 0);
}

function dateFromValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function upcomingInspectionCount(rows: Record<string, unknown>[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return rows.filter((row) => {
    if (row.status === "inspectionScheduled") {
      return true;
    }

    const date = dateFromValue(row.preferredInspectionDate);
    return date ? date >= today && date <= thirtyDaysFromNow : false;
  }).length;
}

export async function getDashboardMetrics(organizationId: string, options: { assignedTo?: string; branchId?: string } = {}): Promise<DashboardMetrics> {
  const branchFilters = options.branchId ? [where("branchId", "==", options.branchId)] : [];
  const leadFilters = options.assignedTo ? [...branchFilters, where("assignedTo", "==", options.assignedTo)] : branchFilters;
  const leadsPath = orgCollectionPath(organizationId, "leads");
  const dealsPath = orgCollectionPath(organizationId, "deals");
  const tasksPath = orgCollectionPath(organizationId, "tasks");
  const [totalLeads, qualifiedLeads, activeClients, activeProperties, availableUnits, reservedUnits, overdueFollowUps, leads, deals, recentActivities] =
    await Promise.all([
      count(leadsPath, leadFilters),
      count(leadsPath, [...leadFilters, where("status", "==", "qualified")]),
      count(orgCollectionPath(organizationId, "clients"), [...branchFilters, where("status", "==", "active")]),
      count(orgCollectionPath(organizationId, "properties"), [...branchFilters, where("propertyStatus", "in", ["available", "reserved", "underNegotiation"])]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [...branchFilters, where("status", "==", "available")]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [...branchFilters, where("status", "==", "reserved")]),
      count(tasksPath, [...branchFilters, where("status", "==", "overdue")]),
      listRecords(leadsPath, leadFilters, 250),
      listRecords(dealsPath, branchFilters, 250),
      listRecentActivities(organizationId, branchFilters),
    ]);
  const statusCounts = countRows(leads, "status");
  const hasDeals = deals.length > 0;

  return {
    totalLeads,
    qualifiedLeads,
    activeClients,
    activeProperties,
    availableUnits,
    reservedUnits,
    activeDeals: hasDeals
      ? deals.filter((deal) => activeRealDealStatuses.includes(String(deal.status ?? ""))).length
      : leads.filter((lead) => activeDealStatuses.includes(String(lead.status ?? ""))).length,
    pipelineValue: hasDeals ? dealPipelineValue(deals) : pipelineValue(leads),
    upcomingInspections: upcomingInspectionCount(leads),
    overdueFollowUps,
    leadPipeline: pipelineStages.map((stage) => ({ name: stage.name, value: statusCounts[stage.key] ?? 0 })),
    leadSources: topSources(leads),
    recentActivities,
  };
}
