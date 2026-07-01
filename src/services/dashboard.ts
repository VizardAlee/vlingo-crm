"use client";

import { collection, getCountFromServer, getDocs, limit, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { dealTargetAmount, revenueCategoryFromDeal, revenueCategoryFromLead, revenueCategoryLabel } from "@/features/finance/finance-utils";
import { db } from "@/lib/firebase/client";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { Deal, FinanceRevenueCategory, Lead } from "@/types/crm";

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
  businessPipeline: DashboardChartPoint[];
  leadInterestCategories: DashboardChartPoint[];
  recentActivities: DashboardActivity[];
}

const pipelineStages = [
  { key: "new", name: "New" },
  { key: "qualified", name: "Qualified" },
  { key: "inspectionScheduled", name: "Inspection" },
  { key: "negotiation", name: "Negotiation" },
  { key: "converted", name: "Converted" },
];

const sourceColors = ["#14550f", "#c9a23d", "#111111", "#1f6f78", "#047857", "#64748b"];
const categoryColors: Record<FinanceRevenueCategory, string> = {
  buildingMaterials: "#c9a23d",
  custom: "#64748b",
  generalServices: "#047857",
  other: "#64748b",
  propertySale: "#1f6f78",
  realEstate: "#14550f",
  rental: "#0f766e",
  solar: "#ca8a04",
  unitSale: "#1f6f78",
};
const activeDealStatuses = ["qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending"];
const activeRealDealStatuses = [...activeDealStatuses, "new"];
const openPipelineStatuses = [...activeDealStatuses, "new", "contacted"];
const coreBusinessCategories: FinanceRevenueCategory[] = ["realEstate", "solar", "buildingMaterials", "generalServices", "custom"];

function logQueryError(context: string, error: unknown) {
  console.error(`[Firestore query failed] ${context}`, error);
}

function describeFilters(filters: QueryConstraint[]) {
  return filters.length ? ` filters=${filters.length}` : "";
}

async function count(path: string, filters: QueryConstraint[] = []) {
  if (!db) {
    return 0;
  }

  try {
    const snapshot = await getCountFromServer(query(collection(db, path), where("isDeleted", "==", false), ...filters));
    return snapshot.data().count;
  } catch (error) {
    logQueryError(`count:${path}${describeFilters(filters)}`, error);
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
    logQueryError(`list:${path}${describeFilters(filters)}`, error);
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
    .reduce((total, row) => total + dealTargetAmount(row as unknown as Deal), 0);
}

function categoryPoint(category: FinanceRevenueCategory, value: number): DashboardChartPoint {
  return {
    color: categoryColors[category],
    name: revenueCategoryLabel(category),
    value,
  };
}

function categoryPointsFromTotals(totals: Partial<Record<FinanceRevenueCategory, number>>) {
  const positiveExtraCategories = Object.keys(totals)
    .filter((category) => !coreBusinessCategories.includes(category as FinanceRevenueCategory))
    .filter((category) => Number(totals[category as FinanceRevenueCategory] ?? 0) > 0) as FinanceRevenueCategory[];
  return [...coreBusinessCategories, ...positiveExtraCategories]
    .map((category) => categoryPoint(category, totals[category] ?? 0));
}

function businessPipelineFromDeals(rows: Record<string, unknown>[]) {
  const totals = rows
    .filter((row) => activeRealDealStatuses.includes(String(row.status ?? "")))
    .reduce<Partial<Record<FinanceRevenueCategory, number>>>((acc, row) => {
      const deal = row as unknown as Deal;
      const category = revenueCategoryFromDeal(deal);
      acc[category] = (acc[category] ?? 0) + dealTargetAmount(deal);
      return acc;
    }, {});

  return categoryPointsFromTotals(totals);
}

function businessPipelineFromLeads(rows: Record<string, unknown>[]) {
  const totals = rows
    .filter((row) => openPipelineStatuses.includes(String(row.status ?? "")))
    .reduce<Partial<Record<FinanceRevenueCategory, number>>>((acc, row) => {
      const category = revenueCategoryFromLead(row as unknown as Lead);
      acc[category] = (acc[category] ?? 0) + Number(row.budgetMaximum ?? row.budgetMinimum ?? 0);
      return acc;
    }, {});

  return categoryPointsFromTotals(totals);
}

function leadInterestCategoryRows(rows: Record<string, unknown>[]) {
  const totals = rows.reduce<Partial<Record<FinanceRevenueCategory, number>>>((acc, row) => {
    const category = revenueCategoryFromLead(row as unknown as Lead);
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  return categoryPointsFromTotals(totals);
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
  const clientFilters = options.assignedTo ? [...branchFilters, where("assignedRelationshipManager", "==", options.assignedTo)] : branchFilters;
  const dealFilters = options.assignedTo ? [...branchFilters, where("dealOwnerId", "==", options.assignedTo)] : branchFilters;
  const taskFilters = options.assignedTo ? [...branchFilters, where("assignedTo", "==", options.assignedTo)] : branchFilters;
  const leadsPath = orgCollectionPath(organizationId, "leads");
  const dealsPath = orgCollectionPath(organizationId, "deals");
  const tasksPath = orgCollectionPath(organizationId, "tasks");
  const [totalLeads, qualifiedLeads, activeClients, activeProperties, availableUnits, reservedUnits, overdueFollowUps, leads, deals, recentActivities] =
    await Promise.all([
      count(leadsPath, leadFilters),
      count(leadsPath, [...leadFilters, where("status", "==", "qualified")]),
      count(orgCollectionPath(organizationId, "clients"), [...clientFilters, where("status", "==", "active")]),
      count(orgCollectionPath(organizationId, "properties"), [...branchFilters, where("propertyStatus", "in", ["available", "reserved", "underNegotiation"])]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [...branchFilters, where("status", "==", "available")]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [...branchFilters, where("status", "==", "reserved")]),
      count(tasksPath, [...taskFilters, where("status", "==", "overdue")]),
      listRecords(leadsPath, leadFilters, 250),
      listRecords(dealsPath, dealFilters, 250),
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
    businessPipeline: hasDeals ? businessPipelineFromDeals(deals) : businessPipelineFromLeads(leads),
    leadInterestCategories: leadInterestCategoryRows(leads),
    recentActivities,
  };
}
