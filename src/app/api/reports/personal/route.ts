import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { firebaseAdminRecovery } from "@/lib/firebase/admin-errors";

export const runtime = "nodejs";

type RecordData = FirebaseFirestore.DocumentData & { id: string };
type ReportPeriod = "30" | "90" | "365" | "all" | "custom";

const qualifiedLeadStatuses = new Set([
  "qualified",
  "propertyRecommended",
  "inspectionScheduled",
  "inspectionCompleted",
  "negotiation",
  "offerMade",
  "paymentPending",
  "converted",
]);
const closedDealStatuses = new Set(["won", "lost"]);

function requestToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function reportPeriod(value: string | null): ReportPeriod {
  return value === "30" || value === "90" || value === "365" || value === "all" ? value : "90";
}

function reportDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+01:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function startForPeriod(period: ReportPeriod) {
  if (period === "all" || period === "custom") {
    return null;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(period) + 1);
  return start;
}

function withinPeriod(record: RecordData, start: Date | null, end: Date | null, field = "createdAt") {
  if (!start && !end) {
    return true;
  }
  const date = dateValue(record[field]) ?? dateValue(record.createdAt);
  return Boolean(date && (!start || date >= start) && (!end || date <= end));
}

function activeRecords(snapshot: FirebaseFirestore.QuerySnapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as RecordData)
    .filter((item) => item.isDeleted !== true) as RecordData[];
}

async function ownedRecords(organizationId: string, collectionName: string, ownerField: string, uid: string) {
  const snapshot = await adminDb.collection(`organizations/${organizationId}/${collectionName}`)
    .where(ownerField, "==", uid)
    .limit(1000)
    .get();
  return activeRecords(snapshot);
}

async function clientsLinkedFromLeads(organizationId: string, leads: RecordData[]) {
  const clientIds = Array.from(new Set(leads.map((lead) => String(lead.clientId ?? "")).filter(Boolean)));
  if (!clientIds.length) return [];
  const snapshots = await adminDb.getAll(...clientIds.map((clientId) => adminDb.doc(`organizations/${organizationId}/clients/${clientId}`)));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as RecordData)
    .filter((record) => record.isDeleted !== true);
}

function countBy(records: RecordData[], field: string) {
  return records.reduce<Record<string, number>>((totals, record) => {
    const key = String(record[field] ?? "notSet");
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, {});
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function attributablePayments(organizationId: string, uid: string, leadIds: string[], dealIds: string[]) {
  const collection = adminDb.collection(`organizations/${organizationId}/financePayments`);
  const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [
    collection.where("revenueOwnerId", "==", uid).limit(1000).get(),
  ];
  for (const sourceIds of chunks(Array.from(new Set([...leadIds, ...dealIds])), 30)) {
    queries.push(collection.where("sourceId", "in", sourceIds).limit(1000).get());
  }
  const snapshots = await Promise.all(queries);
  const leadIdSet = new Set(leadIds);
  const dealIdSet = new Set(dealIds);
  const payments = new Map<string, RecordData>();
  for (const payment of snapshots.flatMap(activeRecords)) {
    const explicitlyOwned = payment.revenueOwnerId === uid;
    const historicallyLinked = !payment.revenueOwnerId && (
      (payment.sourceType === "lead" && leadIdSet.has(String(payment.sourceId))) ||
      (payment.sourceType === "deal" && dealIdSet.has(String(payment.sourceId)))
    );
    if (explicitlyOwned || historicallyLinked) {
      payments.set(payment.id, payment);
    }
  }
  return Array.from(payments.values());
}

function amountForDeal(deal: RecordData) {
  return Number(deal.agreedAmount ?? deal.offerAmount ?? deal.quoteSubtotal ?? deal.reservationAmount ?? deal.depositAmount ?? 0);
}

function monthRows(payments: RecordData[], start: Date | null) {
  const months = start ? Math.min(12, Math.max(1, Math.ceil((Date.now() - start.getTime()) / 2_629_746_000))) : 12;
  const rows = Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (months - 1 - index));
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-NG", { month: "short", year: "numeric" }),
      value: 0,
    };
  });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  for (const payment of payments) {
    const date = dateValue(payment.at) ?? dateValue(payment.createdAt);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const row = rowByKey.get(key);
    if (row) row.value += Number(payment.amount ?? 0);
  }
  return rows.map(({ label, value }) => ({ label, value }));
}

function isoDate(value: unknown) {
  return dateValue(value)?.toISOString() ?? null;
}

function leadTimeline(
  leads: RecordData[],
  activities: RecordData[],
  tasks: RecordData[],
  uid: string,
  start: Date | null,
  end: Date | null,
) {
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const entries: Array<{ at: string; detail: string; kind: string; leadId: string; leadName: string; title: string }> = [];
  const addEntry = (entry: (typeof entries)[number]) => {
    const date = new Date(entry.at);
    if ((!start || date >= start) && (!end || date <= end)) entries.push(entry);
  };

  for (const lead of leads) {
    const leadName = String(lead.fullName ?? lead.companyName ?? lead.referenceNumber ?? "Lead");
    if (lead.createdBy === uid) {
      const at = isoDate(lead.createdAt);
      if (at) addEntry({ at, detail: String(lead.source ?? "Lead captured"), kind: "leadCreated", leadId: lead.id, leadName, title: "Lead created" });
    }
    if (!Array.isArray(lead.stageHistory)) continue;
    for (const history of lead.stageHistory) {
      if (!history || typeof history !== "object") continue;
      const item = history as Record<string, unknown>;
      if (item.userId !== uid) continue;
      const at = isoDate(item.at);
      if (!at) continue;
      addEntry({
        at,
        detail: String(item.note ?? "Stage updated"),
        kind: "stageChange",
        leadId: lead.id,
        leadName,
        title: `${String(item.from ?? "Lead")} -> ${String(item.to ?? "Updated")}`,
      });
    }
  }

  for (const activity of activities) {
    const leadId = String(activity.relatedEntityId ?? "");
    const lead = leadById.get(leadId);
    const at = isoDate(activity.createdAt) ?? isoDate(activity.updatedAt);
    if (!lead || !at) continue;
    addEntry({
      at,
      detail: String(activity.body ?? activity.status ?? "Interaction logged").slice(0, 240),
      kind: String(activity.type ?? "interaction"),
      leadId,
      leadName: String(lead.fullName ?? lead.companyName ?? lead.referenceNumber ?? "Lead"),
      title: String(activity.subject ?? "Lead interaction"),
    });
  }

  for (const task of tasks) {
    if (task.relatedEntityType !== "lead") continue;
    const leadId = String(task.relatedEntityId ?? "");
    const lead = leadById.get(leadId);
    const at = isoDate(task.updatedAt) ?? isoDate(task.createdAt);
    if (!lead || !at) continue;
    addEntry({
      at,
      detail: `Follow-up task is ${String(task.status ?? "not started")}.`,
      kind: "followUpTask",
      leadId,
      leadName: String(lead.fullName ?? lead.companyName ?? lead.referenceNumber ?? "Lead"),
      title: String(task.title ?? "Lead follow-up"),
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const token = requestToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const memberSnapshot = await adminDb.doc(`organizations/${organizationId}/members/${decoded.uid}`).get();
    const member = memberSnapshot.data();
    if (!memberSnapshot.exists || member?.status !== "active") {
      return NextResponse.json({ error: "You do not have access to this organization." }, { status: 403 });
    }

    const requestedFrom = url.searchParams.get("from");
    const requestedTo = url.searchParams.get("to");
    if (Boolean(requestedFrom) !== Boolean(requestedTo)) {
      return NextResponse.json({ error: "Choose both a report start date and end date." }, { status: 400 });
    }
    const customStart = reportDate(requestedFrom);
    const customEnd = reportDate(requestedTo, true);
    if ((requestedFrom && !customStart) || (requestedTo && !customEnd) || (customStart && customEnd && customStart > customEnd)) {
      return NextResponse.json({ error: "Choose a valid report date range." }, { status: 400 });
    }
    const period: ReportPeriod = customStart && customEnd ? "custom" : reportPeriod(url.searchParams.get("period"));
    const start = customStart ?? startForPeriod(period);
    const end = customEnd;
    const [allLeads, allClients, allDeals, allTasks, allActivities] = await Promise.all([
      ownedRecords(organizationId, "leads", "assignedTo", decoded.uid),
      ownedRecords(organizationId, "clients", "assignedRelationshipManager", decoded.uid),
      ownedRecords(organizationId, "deals", "dealOwnerId", decoded.uid),
      ownedRecords(organizationId, "tasks", "assignedTo", decoded.uid),
      ownedRecords(organizationId, "activities", "createdBy", decoded.uid),
    ]);
    const ownedLeadIds = new Set(allLeads.map((lead) => lead.id));
    const allLeadActivities = allActivities.filter((activity) => (
      activity.relatedEntityType === "lead" && ownedLeadIds.has(String(activity.relatedEntityId ?? ""))
    ));
    const linkedClients = await clientsLinkedFromLeads(organizationId, allLeads);
    const mergedClients = new Map([...allClients, ...linkedClients].map((record) => [record.id, record]));
    const leads = allLeads.filter((record) => withinPeriod(record, start, end));
    const clients = Array.from(mergedClients.values()).filter((record) => withinPeriod(record, start, end));
    const deals = allDeals.filter((record) => withinPeriod(record, start, end));
    const tasks = allTasks.filter((record) => withinPeriod(record, start, end));
    const leadActivities = allLeadActivities.filter((record) => withinPeriod(record, start, end));
    const allPayments = await attributablePayments(
      organizationId,
      decoded.uid,
      allLeads.map((record) => record.id),
      allDeals.map((record) => record.id),
    );
    const payments = allPayments.filter((record) => withinPeriod(record, start, end, "at"));
    const verifiedPayments = payments.filter((record) => record.verificationStatus === "verified");
    const pendingPayments = payments.filter((record) => record.verificationStatus === "pending");
    const wonDeals = deals.filter((record) => record.status === "won");
    const qualifiedLeads = leads.filter((record) => qualifiedLeadStatuses.has(String(record.status)));
    const convertedLeads = leads.filter((record) => record.status === "converted");
    const completedTasks = tasks.filter((record) => record.status === "completed");
    const contactedLeadIds = new Set(leadActivities.map((activity) => String(activity.relatedEntityId ?? "")).filter(Boolean));
    const revenueByCategory = verifiedPayments.reduce<Record<string, number>>((totals, payment) => {
      const category = String(payment.revenueCategory ?? "other");
      totals[category] = (totals[category] ?? 0) + Number(payment.amount ?? 0);
      return totals;
    }, {});

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      member: { displayName: member.displayName ?? decoded.name ?? "User", email: member.email ?? decoded.email ?? "" },
      metrics: {
        activeClients: clients.filter((record) => record.status === "active").length,
        amountGenerated: verifiedPayments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0),
        clientCount: clients.length,
        completedTasks: completedTasks.length,
        contactedLeads: contactedLeadIds.size,
        conversionRate: leads.length ? (convertedLeads.length / leads.length) * 100 : 0,
        convertedLeads: convertedLeads.length,
        dealCount: deals.length,
        leadCount: leads.length,
        leadInteractions: leadActivities.length,
        pendingRevenue: pendingPayments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0),
        pipelineValue: deals.filter((record) => !closedDealStatuses.has(String(record.status))).reduce((total, deal) => total + amountForDeal(deal), 0),
        qualifiedLeads: qualifiedLeads.length,
        taskCompletionRate: tasks.length ? (completedTasks.length / tasks.length) * 100 : 0,
        taskCount: tasks.length,
        wonDeals: wonDeals.length,
        wonValue: wonDeals.reduce((total, deal) => total + amountForDeal(deal), 0),
      },
      breakdowns: {
        dealStatus: countBy(deals, "status"),
        leadInteractionType: countBy(leadActivities, "type"),
        leadSource: countBy(leads, "source"),
        leadStatus: countBy(leads, "status"),
        revenueByCategory,
        revenueByMonth: monthRows(verifiedPayments, start),
        taskStatus: countBy(tasks, "status"),
      },
      period,
      periodEnd: end?.toISOString() ?? null,
      periodStart: start?.toISOString() ?? null,
      revenueAttributionNote: "Verified revenue linked to your owned leads and deals is included. Older direct property, unit, rental, and other-income receipts without a revenue owner are excluded.",
      timeline: leadTimeline(allLeads, allLeadActivities, allTasks, decoded.uid, start, end),
    });
  } catch (error) {
    const recovery = firebaseAdminRecovery(error, "Personal reports");
    if (recovery) {
      console.warn(`[Personal report unavailable] ${recovery.error}`);
      return NextResponse.json(recovery, { status: 503 });
    }
    console.error("[Personal report failed]", error);
    return NextResponse.json({ error: "Unable to generate your performance report right now." }, { status: 503 });
  }
}
