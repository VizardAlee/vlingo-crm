"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where, type QueryConstraint } from "firebase/firestore";
import { Banknote, Building2, CalendarClock, CheckCircle2, CircleCheck, Clock, FileClock, Flame, GitBranch, Handshake, Home, ListTodo, Mail, MessageSquarePlus, PhoneCall, Plus, ReceiptText, Repeat2, Send, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { WhatsAppPhoneLink } from "@/components/ui/whatsapp-link";
import { PermissionDenied, LoadingState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { CrmTable } from "@/components/tables/crm-table";
import { AiGuideLink } from "@/features/ai-guide/ai-guide-link";
import { ModuleForm } from "@/features/modules/module-form";
import { columnsFor, type ModuleConfig } from "@/features/modules/module-config";
import { useAuth } from "@/features/auth/auth-provider";
import { documentAccessPermissions } from "@/components/layout/navigation";
import { effectiveBranchId, hasAnyPermission, hasPermission, isAssignedOnlySalesUser, memberRoles } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, statusTone, titleCase } from "@/lib/utils";
import { listDocuments, type DocumentRecord } from "@/services/documents";
import { sendBulkSalesEmail, sendSalesJourneyEmail } from "@/services/email-settings";
import { createOrgRecord, getOrgRecord, listOrgRecords, softDeleteOrgRecord, updateOrgRecord, writeAuditLog } from "@/services/repository";
import { listMembers } from "@/services/users";
import { convertLeadToClient } from "@/services/workflows";
import type { Member } from "@/types/crm";

type RelatedEntityType = "deal" | "lead" | "client" | "property" | "unit" | "task" | "tenancy" | "development" | "marketing" | "offering";

function moduleSingularTitle(config: ModuleConfig) {
  return config.singularTitle ?? config.title.slice(0, -1);
}

type ModuleToast = (toast: { description?: string; title: string; variant?: "error" | "info" | "success" }) => void;

async function openGoogleCalendarSettings(user: { uid: string } | null | undefined, toast: ModuleToast) {
  if (!user) {
    toast({ title: "Sign in required", description: "Sign in again before connecting Google Calendar.", variant: "error" });
    return false;
  }
  window.location.assign("/settings/calendar");
  return true;
}

function relatedTypeForCollection(collection: ModuleConfig["collection"]): RelatedEntityType | null {
  if (collection === "leads") {
    return "lead";
  }

  if (collection === "clients") {
    return "client";
  }

  if (collection === "deals") {
    return "deal";
  }

  if (collection === "properties") {
    return "property";
  }

  if (collection === "propertyUnits") {
    return "unit";
  }

  if (collection === "tasks") {
    return "task";
  }

  if (collection === "rentalTenancies") {
    return "tenancy";
  }

  if (collection === "developmentProjects") {
    return "development";
  }

  if (collection === "marketingCampaigns") {
    return "marketing";
  }

  if (collection === "offerings") {
    return "offering";
  }

  return null;
}

function collectionForRelatedEntity(type: unknown): ModuleConfig["collection"] | null {
  if (type === "lead") {
    return "leads";
  }

  if (type === "client") {
    return "clients";
  }

  if (type === "deal") {
    return "deals";
  }

  if (type === "property") {
    return "properties";
  }

  if (type === "unit") {
    return "propertyUnits";
  }

  if (type === "task") {
    return "tasks";
  }

  if (type === "tenancy") {
    return "rentalTenancies";
  }

  if (type === "development") {
    return "developmentProjects";
  }

  if (type === "marketing") {
    return "marketingCampaigns";
  }

  if (type === "offering") {
    return "offerings";
  }

  return null;
}

function routeForRelatedEntity(type: unknown, id: string) {
  const collectionName = collectionForRelatedEntity(type);
  if (!collectionName) {
    return null;
  }

  if (collectionName === "propertyUnits") {
    return `/units/${id}`;
  }

  if (collectionName === "rentalTenancies") {
    return `/rentals/${id}`;
  }

  if (collectionName === "developmentProjects") {
    return `/development/${id}`;
  }

  if (collectionName === "marketingCampaigns") {
    return `/marketing/${id}`;
  }

  if (collectionName === "offerings") {
    return `/offerings/${id}`;
  }

  if (collectionName === "deals") {
    return `/deals/${id}`;
  }

  return `/${collectionName}/${id}`;
}

function recordDisplayName(record: Record<string, unknown>) {
  return String(record.fullName ?? record.tenantName ?? record.name ?? record.title ?? record.subject ?? record.unitNumber ?? record.referenceNumber ?? record.id ?? "Record");
}

async function safeListOrgRecords(organizationId: string, collectionName: "tasks" | "activities" | "offerings" | "properties" | "propertyUnits", constraints: QueryConstraint[] = []) {
  try {
    return await listOrgRecords<Record<string, unknown> & { id: string }>(organizationId, collectionName, constraints);
  } catch {
    return [];
  }
}

async function safeListDocuments(organizationId: string, constraints: QueryConstraint[] = []) {
  try {
    return await listDocuments(organizationId, constraints);
  } catch {
    return [];
  }
}

async function safeListMembers(organizationId: string) {
  try {
    return await listMembers(organizationId);
  } catch {
    return [];
  }
}

async function safeGetRelatedRecord(organizationId: string, record: Record<string, unknown> | null) {
  if (!record?.relatedEntityId) {
    return null;
  }

  const collectionName = collectionForRelatedEntity(record.relatedEntityType);
  if (!collectionName) {
    return null;
  }

  try {
    return await getOrgRecord<Record<string, unknown> & { id: string }>(organizationId, collectionName, String(record.relatedEntityId));
  } catch {
    return null;
  }
}

async function safeGetLinkedProperty(organizationId: string, record: Record<string, unknown> | null) {
  if (!record?.propertyId) {
    return null;
  }

  try {
    return await getOrgRecord<Record<string, unknown> & { id: string }>(organizationId, "properties", String(record.propertyId));
  } catch {
    return null;
  }
}

const leadJourneyStages = [
  { description: "Fresh lead from manual entry or import.", key: "new", label: "New" },
  { description: "A call, WhatsApp, email, or visit has happened.", key: "contacted", label: "Contacted" },
  { description: "Budget, need, location, and timeline are understood.", key: "qualified", label: "Qualified" },
  { description: "A matching property or unit has been suggested.", key: "propertyRecommended", label: "Recommended" },
  { description: "A physical or virtual inspection has been booked.", key: "inspectionScheduled", label: "Inspection set" },
  { description: "Inspection has happened and outcome is recorded.", key: "inspectionCompleted", label: "Inspection done" },
  { description: "Price, payment plan, and terms are being discussed.", key: "negotiation", label: "Negotiation" },
  { description: "Proposal, offer, or reservation details have been shared.", key: "offerMade", label: "Offer made" },
  { description: "Deposit, reservation fee, or formal commitment is pending.", key: "paymentPending", label: "Payment pending" },
] as const;

const terminalLeadStages = [
  { icon: CircleCheck, key: "converted", label: "Closed won" },
  { icon: XCircle, key: "lost", label: "Closed lost" },
] as const;

const interactionTypes = [
  "phoneCall",
  "whatsappMessage",
  "email",
  "meeting",
  "inspection",
  "followUp",
  "documentRequest",
  "internalNote",
] as const;

const lostReasons = ["No budget", "Wrong location", "Bought elsewhere", "Unreachable", "Price issue", "Timeline changed", "Not serious", "Duplicate lead", "Other"];

function dateDisplay(value: unknown) {
  if (!value) {
    return "Not set";
  }

  if (value instanceof Date || typeof value === "string") {
    return formatDate(value);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatDate(value.toDate() as Date);
  }

  return String(value);
}

function formatRecordValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Not set";
  }

  if (value instanceof Date || typeof value === "string") {
    return String(value);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return dateDisplay(value);
  }

  return String(value);
}

function isPhoneField(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("phone") || normalized.includes("whatsapp");
}

function isAmountField(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("amount") || normalized.includes("balance") || normalized.includes("budget") || normalized.includes("price");
}

function userDisplay(value: unknown, members: Member[]) {
  if (!value) {
    return "Not set";
  }

  const user = members.find((item) => item.id === value);
  if (!user) {
    return "Unknown user";
  }

  return user.email ? `${user.displayName} (${user.email})` : user.displayName;
}

function recordValueDisplay(record: Record<string, unknown>, key: string, value: unknown, collection: ModuleConfig["collection"], members: Member[]) {
  if (collection === "activities" && (key === "createdBy" || key === "updatedBy")) {
    return <span className="max-w-64 truncate font-medium">{userDisplay(value, members)}</span>;
  }

  if ((collection === "leads" || collection === "clients") && isPhoneField(key)) {
    const displayNumber = value ? String(value) : "";
    const phoneNumber = key === "phoneNumber" && record.whatsappNumber ? String(record.whatsappNumber) : displayNumber;
    return <WhatsAppPhoneLink className="max-w-48 truncate" displayNumber={displayNumber} phoneNumber={phoneNumber} />;
  }

  if (typeof value === "number" && isAmountField(key)) {
    return <span className="max-w-48 truncate font-medium">{formatCurrency(value)}</span>;
  }

  return <span className="max-w-48 truncate font-medium">{formatRecordValue(value)}</span>;
}

function recordSummaryEntries(record: Record<string, unknown>, collection: ModuleConfig["collection"]) {
  if (collection === "deals") {
    return [
      "referenceNumber",
      "dealType",
      "status",
      "financeStatus",
      "proposalStatus",
      "fulfillmentStatus",
      "agreedAmount",
      "offerAmount",
      "quoteSubtotal",
      "paidAmount",
      "pendingPaymentAmount",
      "balanceAmount",
      "lastReceiptNumber",
      "clientName",
      "leadName",
      "offeringName",
      "propertyName",
      "unitName",
      "createdByName",
      "createdByEmail",
      "createdAt",
    ]
      .filter((key) => key in record)
      .map((key) => ({ key, label: titleCase(key), value: record[key] }));
  }

  if (collection === "leads") {
    return [
      "referenceNumber",
      "fullName",
      "phoneNumber",
      "email",
      "status",
      "transactionInterest",
      "offeringName",
      "propertyName",
      "unitName",
      "createdByName",
      "createdByEmail",
      "createdAt",
    ]
      .filter((key) => key in record)
      .map((key) => ({ key, label: titleCase(key), value: record[key] }));
  }

  if (collection === "clients") {
    return [
      "referenceNumber",
      "fullName",
      "phoneNumber",
      "email",
      "clientType",
      "category",
      "status",
      "createdByName",
      "createdByEmail",
      "createdAt",
    ]
      .filter((key) => key in record)
      .map((key) => ({ key, label: titleCase(key), value: record[key] }));
  }

  if (collection !== "activities") {
    return Object.entries(record).slice(0, 8).map(([key, value]) => ({ key, label: key, value }));
  }

  return [
    "subject",
    "type",
    "status",
    "relatedEntityType",
    "relatedEntityId",
    "createdBy",
    "updatedBy",
    "createdAt",
    "updatedAt",
  ]
    .filter((key) => key in record)
    .map((key) => ({ key, label: titleCase(key), value: record[key] }));
}

function shouldResolveUserSnapshots(collection: ModuleConfig["collection"]) {
  return ["activities", "leads", "clients", "deals"].includes(collection);
}

function enrichCreatorSnapshot<T extends Record<string, unknown> | null>(record: T, members: Member[]): T {
  if (!record || record.createdByName || !record.createdBy) {
    return record;
  }

  const creator = members.find((member) => member.id === record.createdBy);
  return creator ? { ...record, createdByEmail: creator.email, createdByName: creator.displayName || creator.email } as T : record;
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function textMatches(candidate: unknown, preferred: unknown) {
  const left = normalizedText(candidate);
  const right = normalizedText(preferred);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function priceForInterest(record: Record<string, unknown>, interest: string) {
  return ["rent", "lease"].includes(interest)
    ? Number(record.rentAmount ?? record.askingPrice ?? 0)
    : Number(record.askingPrice ?? record.minimumAcceptablePrice ?? record.rentAmount ?? 0);
}

function isAvailableOffering(record: Record<string, unknown>) {
  return !["sold", "rented", "leased", "occupied", "unavailable", "withdrawn", "underMaintenance"].includes(String(record.status ?? record.propertyStatus ?? ""));
}

function matchScore(lead: Record<string, unknown>, offering: Record<string, unknown>) {
  const interest = String(lead.transactionInterest ?? "");
  const transactionTypes = Array.isArray(offering.transactionTypes) ? offering.transactionTypes : [];
  let score = 0;

  if (transactionTypes.some((type) => textMatches(type, interest === "buy" ? "sale" : interest))) {
    score += 3;
  }

  if ([offering.city, offering.state, offering.estateOrNeighborhood, offering.propertyName].some((value) => textMatches(value, lead.preferredCity) || textMatches(value, lead.preferredState) || textMatches(value, lead.preferredLocation))) {
    score += 3;
  }

  if (textMatches(offering.category ?? offering.unitType, lead.preferredPropertyCategory) || textMatches(offering.category ?? offering.unitType, lead.propertyType)) {
    score += 2;
  }

  if (Number(lead.preferredBedrooms ?? 0) && Number(offering.bedrooms ?? 0) >= Number(lead.preferredBedrooms)) {
    score += 1;
  }

  const price = priceForInterest(offering, interest);
  const minBudget = Number(lead.budgetMinimum ?? 0);
  const maxBudget = Number(lead.budgetMaximum ?? 0);
  if (price && (!minBudget || price >= minBudget) && (!maxBudget || price <= maxBudget)) {
    score += 3;
  }

  return score;
}

function offeringCatalogPrice(record: Record<string, unknown>) {
  return Number(record.sellingPrice ?? record.askingPrice ?? record.rentAmount ?? 0);
}

function catalogMatchScore(lead: Record<string, unknown>, offering: Record<string, unknown>) {
  let score = 0;
  const tags = Array.isArray(offering.tags) ? offering.tags : [];
  const searchValues = [offering.name, offering.category, offering.type, offering.vertical, ...tags];

  if (searchValues.some((value) => textMatches(value, lead.propertyType) || textMatches(value, lead.preferredPropertyCategory) || textMatches(value, lead.intendedUse))) {
    score += 4;
  }

  if (String(offering.vertical) === "realEstate" && ["buy", "rent", "lease", "invest"].includes(String(lead.transactionInterest ?? ""))) {
    score += 1;
  }

  const price = offeringCatalogPrice(offering);
  const minBudget = Number(lead.budgetMinimum ?? 0);
  const maxBudget = Number(lead.budgetMaximum ?? 0);
  if (price && (!minBudget || price >= minBudget) && (!maxBudget || price <= maxBudget)) {
    score += 3;
  }

  return score;
}

function LeadOfferingPanel({
  offerings,
  propertyUnits,
  properties,
  record,
}: {
  offerings: Record<string, unknown>[];
  propertyUnits: Record<string, unknown>[];
  properties: Record<string, unknown>[];
  record: Record<string, unknown>;
}) {
  const linkedProperty = record.propertyId ? properties.find((property) => property.id === record.propertyId) : null;
  const linkedUnit = record.unitId ? propertyUnits.find((unit) => unit.id === record.unitId) : null;
  const linkedOffering = record.offeringId ? offerings.find((offering) => offering.id === record.offeringId) : null;
  const propertyLabel = String(linkedProperty?.name ?? record.propertyName ?? record.propertyReferenceNumber ?? "");
  const unitLabel = String(linkedUnit?.unitNumber ?? record.unitName ?? "");
  const offeringLabel = String(linkedOffering?.name ?? record.offeringName ?? record.offeringReferenceNumber ?? "");
  const unitMatches = propertyUnits
    .filter(isAvailableOffering)
    .map((unit) => ({
      href: `/units/${unit.id}`,
      id: String(unit.id),
      label: String(unit.unitNumber ?? unit.referenceNumber ?? "Unit"),
      price: priceForInterest(unit, String(record.transactionInterest ?? "")),
      score: matchScore(record, unit),
      subtitle: [unit.propertyName, unit.unitType, unit.bedrooms ? `${unit.bedrooms} bed` : ""].filter(Boolean).join(" · "),
      type: "Unit",
    }));
  const propertyMatches = properties
    .filter(isAvailableOffering)
    .map((property) => ({
      href: `/properties/${property.id}`,
      id: String(property.id),
      label: String(property.name ?? property.referenceNumber ?? "Property"),
      price: priceForInterest(property, String(record.transactionInterest ?? "")),
      score: matchScore(record, property),
      subtitle: [property.city, property.category, property.bedrooms ? `${property.bedrooms} bed` : ""].filter(Boolean).join(" · "),
      type: "Property",
    }));
  const offeringMatches = offerings
    .filter((offering) => String(offering.status ?? "active") === "active")
    .map((offering) => ({
      href: `/offerings/${offering.id}`,
      id: String(offering.id),
      label: String(offering.name ?? offering.referenceNumber ?? "Product/service"),
      price: offeringCatalogPrice(offering),
      score: catalogMatchScore(record, offering),
      subtitle: [titleCase(String(offering.vertical ?? "")), titleCase(String(offering.type ?? "")), offering.category].filter(Boolean).join(" · "),
      type: "Product/service",
    }));
  const matches = [...unitMatches, ...propertyMatches, ...offeringMatches]
    .filter((match) => match.score > 0 && match.id !== record.unitId && match.id !== record.propertyId && match.id !== record.offeringId)
    .sort((left, right) => right.score - left.score || right.price - left.price)
    .slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Linked Product/Service</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {propertyLabel || unitLabel || offeringLabel ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Product/service</span>
                {record.offeringId ? <Link className="max-w-56 truncate font-medium text-primary" href={`/offerings/${record.offeringId}`}>{offeringLabel || "View product/service"}</Link> : <span className="font-medium">{offeringLabel || "Not linked"}</span>}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Property</span>
                {record.propertyId ? <Link className="max-w-56 truncate font-medium text-primary" href={`/properties/${record.propertyId}`}>{propertyLabel || "View property"}</Link> : <span className="font-medium">{propertyLabel || "Not linked"}</span>}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Unit</span>
                {record.unitId ? <Link className="max-w-56 truncate font-medium text-primary" href={`/units/${record.unitId}`}>{unitLabel || "View unit"}</Link> : <span className="font-medium">{unitLabel || "Not linked"}</span>}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-muted-foreground">No product/service, property, or unit has been linked to this lead yet.</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Matching Products/Services</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {matches.length ? matches.map((match) => (
            <Link className="rounded-md border p-3 hover:bg-muted" href={match.href} key={`${match.type}-${match.id}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{match.label}</span>
                <Badge tone="success">{match.score} match</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{match.type} · {match.subtitle || "Inventory"} · {formatCurrency(match.price)}</p>
            </Link>
          )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No strong property matches from current inventory yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function isOpenTask(task: Record<string, unknown>) {
  return !["completed", "cancelled"].includes(String(task.status ?? ""));
}

function parseDateObject(value: unknown) {
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

function dateInputString(value: unknown) {
  const date = parseDateObject(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function daysUntil(value: unknown) {
  const date = parseDateObject(value);
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function addMonthsToInputDate(value: unknown, months: number) {
  const date = parseDateObject(value);
  if (!date) {
    return "";
  }

  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function rentCycleMonths(value: unknown) {
  if (value === "monthly") {
    return 1;
  }

  if (value === "quarterly") {
    return 3;
  }

  if (value === "biannual") {
    return 6;
  }

  if (value === "annual") {
    return 12;
  }

  return 0;
}

const rentalPaymentStatusOptions = ["notInvoiced", "invoiced", "partPaid", "paid", "overdue"] as const;
const rentalTenancyStatusOptions = ["draft", "active", "expiringSoon", "renewalDue", "renewed", "terminated", "defaulting", "movedOut"] as const;
const paymentMethods = ["bankTransfer", "cash", "pos", "cheque", "onlinePayment", "other"] as const;
const developmentStatusOptions = ["concept", "planning", "approval", "procurement", "construction", "inspection", "handover", "completed", "onHold", "cancelled"] as const;
const developmentRiskOptions = ["low", "medium", "high", "critical"] as const;

function DevelopmentOperationsPanel({
  activities,
  id,
  onChanged,
  record,
  tasks,
}: {
  activities: Record<string, unknown>[];
  id: string;
  onChanged: () => Promise<void>;
  record: Record<string, unknown>;
  tasks: Record<string, unknown>[];
}) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const budget = Number(record.budget ?? 0);
  const amountSpent = Number(record.amountSpent ?? 0);
  const progressPercent = Number(record.progressPercent ?? 0);
  const remainingBudget = Math.max(0, budget - amountSpent);
  const completionDays = daysUntil(record.expectedCompletionDate);
  const openTasks = tasks.filter(isOpenTask);
  const [nextStatus, setNextStatus] = useState(String(record.status ?? "concept"));
  const [nextPhase, setNextPhase] = useState(String(record.currentPhase ?? ""));
  const [nextProgress, setNextProgress] = useState(String(record.progressPercent ?? ""));
  const [nextAmountSpent, setNextAmountSpent] = useState(String(record.amountSpent ?? ""));
  const [nextRiskLevel, setNextRiskLevel] = useState(String(record.riskLevel ?? "medium"));
  const [siteNote, setSiteNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [saving, setSaving] = useState<"progress" | "task" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const context = user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null;
  const canUpdateDevelopment = hasPermission(member, "development.update");
  const canCreateActivity = hasPermission(member, "activities.create");
  const canCreateTask = hasPermission(member, "tasks.create");

  useEffect(() => {
    if (success) {
      toast({ title: "Development updated", description: success, variant: "success" });
    }
  }, [success, toast]);

  useEffect(() => {
    if (error) {
      toast({ title: "Development action failed", description: error, variant: "error" });
    }
  }, [error, toast]);

  async function handleProgressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to update development progress.");
      return;
    }

    const parsedProgress = Number(nextProgress || 0);
    if (parsedProgress < 0 || parsedProgress > 100) {
      setError("Progress must be between 0 and 100.");
      return;
    }

    const parsedSpent = Number(nextAmountSpent || 0);
    if (parsedSpent < 0) {
      setError("Amount spent cannot be negative.");
      return;
    }

    setSaving("progress");
    setError(null);
    setSuccess(null);
    const payload = {
      amountSpent: parsedSpent,
      currentPhase: nextPhase.trim(),
      progressPercent: parsedProgress,
      riskLevel: nextRiskLevel,
      status: nextStatus,
    };
    try {
      await updateOrgRecord("developmentProjects", id, payload, context);
      if (canCreateActivity && siteNote.trim()) {
        const activityId = await createOrgRecord("activities", {
          body: siteNote.trim(),
          relatedEntityId: id,
          relatedEntityType: "development",
          status: "completed",
          subject: `Development update: ${titleCase(nextStatus)}`,
          type: "internalNote",
        }, context, "ACT");
        await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: `Development update: ${titleCase(nextStatus)}` });
      }
      await writeAuditLog(context, "development.progressUpdate", "developmentProjects", id, payload);
      setSiteNote("");
      setSuccess("Development progress updated.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update development progress.");
    } finally {
      setSaving(null);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to create project tasks.");
      return;
    }

    if (!taskTitle.trim()) {
      setError("Add a project task title.");
      return;
    }

    setSaving("task");
    setError(null);
    setSuccess(null);
    try {
      const taskId = await createOrgRecord("tasks", {
        assignedTo: String(record.projectManagerId ?? context.userId),
        description: `Development task for ${String(record.name ?? record.referenceNumber ?? id)}`,
        dueAt: taskDueAt,
        estimatedDurationMinutes: 60,
        expectedOutcome: "Project team completes the next site action and updates the development record.",
        location: String(record.siteAddress ?? record.location ?? record.city ?? record.state ?? ""),
        priority: taskPriority,
        reminderMinutesBefore: 1440,
        relatedEntityId: id,
        relatedEntityType: "development",
        status: "notStarted",
        title: taskTitle.trim(),
      }, context, "TASK");
      await writeAuditLog(context, "task.create", "tasks", taskId, { relatedEntityId: id, title: taskTitle.trim() });
      setTaskTitle("");
      setTaskDueAt("");
      setSuccess("Project task created.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create project task.");
    } finally {
      setSaving(null);
    }
  }

  const healthCards = [
    { icon: CircleCheck, label: "Progress", tone: progressPercent >= 80 ? "text-success" : "text-primary", value: `${progressPercent}%` },
    { icon: Banknote, label: "Budget used", tone: budget && amountSpent > budget ? "text-destructive" : "text-warning", value: budget ? `${formatCurrency(amountSpent)} / ${formatCurrency(budget)}` : formatCurrency(amountSpent) },
    { icon: CalendarClock, label: "Completion", tone: completionDays !== null && completionDays < 0 ? "text-destructive" : "text-muted-foreground", value: completionDays === null ? dateDisplay(record.expectedCompletionDate) : completionDays < 0 ? `${Math.abs(completionDays)} day${Math.abs(completionDays) === 1 ? "" : "s"} late` : `${completionDays} day${completionDays === 1 ? "" : "s"} left` },
    { icon: Flame, label: "Risk", tone: ["high", "critical"].includes(String(record.riskLevel ?? "")) ? "text-destructive" : "text-success", value: titleCase(String(record.riskLevel ?? "medium")) },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Development Operations</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Track delivery progress, site updates, project tasks, budget burn, and handover readiness.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(String(record.status ?? "concept"))}>{titleCase(String(record.status ?? "concept"))}</Badge>
            <Badge tone={openTasks.length ? "warning" : "muted"}>{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {healthCards.map((card) => {
              const Icon = card.icon;
              return (
                <div className="rounded-md border bg-white p-3" key={card.label}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">{card.label}</p>
                    <Icon className={cn("h-4 w-4", card.tone)} />
                  </div>
                  <p className="mt-1 text-lg font-semibold">{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Linked property</p>
              {record.propertyId ? (
                <Link className="mt-1 block truncate text-lg font-semibold text-primary" href={`/properties/${record.propertyId}`}>{String(record.propertyName ?? record.propertyReferenceNumber ?? "View property")}</Link>
              ) : (
                <p className="mt-1 text-lg font-semibold">Not linked</p>
              )}
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Current phase</p>
              <p className="mt-1 text-lg font-semibold">{String(record.currentPhase ?? "Not set")}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Remaining budget</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(remainingBudget)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Update Delivery</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleProgressSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Project status">
                  <Select disabled={!canUpdateDevelopment} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                    {developmentStatusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                  </Select>
                </Field>
                <Field label="Risk level">
                  <Select disabled={!canUpdateDevelopment} value={nextRiskLevel} onChange={(event) => setNextRiskLevel(event.target.value)}>
                    {developmentRiskOptions.map((risk) => <option key={risk} value={risk}>{titleCase(risk)}</option>)}
                  </Select>
                </Field>
                <Field label="Current phase">
                  <Input disabled={!canUpdateDevelopment} value={nextPhase} onChange={(event) => setNextPhase(event.target.value)} />
                </Field>
                <Field label="Progress %">
                  <Input disabled={!canUpdateDevelopment} max="100" min="0" type="number" value={nextProgress} onChange={(event) => setNextProgress(event.target.value)} />
                </Field>
                <Field label="Amount spent">
                  <Input disabled={!canUpdateDevelopment} min="0" type="number" value={nextAmountSpent} onChange={(event) => setNextAmountSpent(event.target.value)} />
                </Field>
              </div>
              <Field label="Site update note">
                <Textarea disabled={!canUpdateDevelopment || !canCreateActivity} placeholder="What changed on site, what is blocked, or what should happen next?" value={siteNote} onChange={(event) => setSiteNote(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canUpdateDevelopment || saving === "progress"} type="submit">
                <Send className="h-4 w-4" />
                {saving === "progress" ? "Updating" : "Update delivery"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Project Task</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleTaskSubmit}>
              <Field label="Task title">
                <Input disabled={!canCreateTask} placeholder="Request permit, inspect roofing, approve invoice..." value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
              </Field>
              <Field label="Due date">
                <Input disabled={!canCreateTask} type="date" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
              </Field>
              <Field label="Priority">
                <Select disabled={!canCreateTask} value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                  {["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
                </Select>
              </Field>
              <Button className="h-11" disabled={!canCreateTask || saving === "task"} type="submit" variant="outline">
                <ListTodo className="h-4 w-4" />
                {saving === "task" ? "Creating" : "Create task"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Site Updates</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {activities.length ? activities.slice(0, 5).map((activity) => (
            <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
            </Link>
          )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No site updates have been logged yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function RentalOperationsPanel({
  activities,
  id,
  onChanged,
  record,
  tasks,
}: {
  activities: Record<string, unknown>[];
  id: string;
  onChanged: () => Promise<void>;
  record: Record<string, unknown>;
  tasks: Record<string, unknown>[];
}) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const rentAmount = Number(record.rentAmount ?? 0);
  const [paymentAmount, setPaymentAmount] = useState(String(rentAmount || ""));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("bankTransfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [nextPaymentStatus, setNextPaymentStatus] = useState(String(record.paymentStatus ?? "notInvoiced"));
  const [nextTenancyStatus, setNextTenancyStatus] = useState(String(record.status ?? "draft"));
  const [statusNote, setStatusNote] = useState("");
  const [renewalDueAt, setRenewalDueAt] = useState(dateInputString(record.renewalNoticeDate || record.leaseEndDate));
  const [saving, setSaving] = useState<"payment" | "status" | "renewal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const context = user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null;
  const canUpdateRental = hasPermission(member, "rentals.update");
  const canCreateActivity = hasPermission(member, "activities.create");
  const canCreateTask = hasPermission(member, "tasks.create");
  const leaseDaysLeft = daysUntil(record.leaseEndDate);
  const rentDaysLeft = daysUntil(record.nextRentDueDate);
  const renewalTasks = tasks.filter((task) => String(task.relatedEntityType) === "tenancy" && /renew|expiry|lease/i.test(String(task.title ?? "")));
  const paymentHistory = Array.isArray(record.paymentHistory) ? record.paymentHistory.slice().reverse() : [];
  const totalPaid = Array.isArray(record.paymentHistory)
    ? record.paymentHistory.reduce((sum, entry) => sum + Number((entry as Record<string, unknown>).amount ?? 0), 0)
    : 0;

  useEffect(() => {
    if (success) {
      toast({ title: "Rental updated", description: success, variant: "success" });
    }
  }, [success, toast]);

  useEffect(() => {
    if (error) {
      toast({ title: "Rental action failed", description: error, variant: "error" });
    }
  }, [error, toast]);

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to record payment.");
      return;
    }

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    const cycleMonths = rentCycleMonths(record.paymentCycle);
    const nextRentDueDate = cycleMonths ? addMonthsToInputDate(record.nextRentDueDate || record.leaseStartDate || paymentDate, cycleMonths) : dateInputString(record.leaseEndDate);
    const paymentEntry = {
      amount,
      at: paymentDate || new Date().toISOString().slice(0, 10),
      method: paymentMethod,
      note: paymentNote.trim(),
      reference: paymentReference.trim(),
      userId: context.userId,
    };
    const existingHistory = Array.isArray(record.paymentHistory) ? record.paymentHistory : [];
    const paymentStatus = amount >= rentAmount ? "paid" : "partPaid";

    setSaving("payment");
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord("rentalTenancies", id, {
        lastPaymentAmount: amount,
        lastPaymentAt: paymentEntry.at,
        nextRentDueDate,
        paymentHistory: [...existingHistory, paymentEntry],
        paymentStatus,
        status: String(record.status ?? "draft") === "draft" ? "active" : record.status,
      }, context);
      const activityId = await createOrgRecord("activities", {
        body: paymentNote.trim() || `Payment received by ${titleCase(paymentMethod)}${paymentReference.trim() ? `, reference ${paymentReference.trim()}` : ""}.`,
        relatedEntityId: id,
        relatedEntityType: "tenancy",
        status: "completed",
        subject: `Rent payment recorded: ${formatCurrency(amount)}`,
        type: "internalNote",
      }, context, "ACT");
      await writeAuditLog(context, "rental.paymentRecord", "rentalTenancies", id, { amount, nextRentDueDate, paymentStatus });
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: `Rent payment recorded: ${formatCurrency(amount)}` });
      setPaymentReference("");
      setPaymentNote("");
      setSuccess("Payment recorded and next rent due date updated.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to record payment.");
    } finally {
      setSaving(null);
    }
  }

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to update this tenancy.");
      return;
    }

    if (!statusNote.trim()) {
      setError("Add a short note before changing rental status.");
      return;
    }

    const statusHistory = Array.isArray(record.statusHistory) ? record.statusHistory : [];
    const nextPayload = {
      paymentStatus: nextPaymentStatus,
      status: nextTenancyStatus,
      statusHistory: [
        ...statusHistory,
        {
          at: new Date().toISOString(),
          fromPaymentStatus: record.paymentStatus ?? "",
          fromStatus: record.status ?? "",
          note: statusNote.trim(),
          toPaymentStatus: nextPaymentStatus,
          toStatus: nextTenancyStatus,
          userId: context.userId,
        },
      ],
    };

    setSaving("status");
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord("rentalTenancies", id, nextPayload, context);
      const activityId = await createOrgRecord("activities", {
        body: statusNote.trim(),
        relatedEntityId: id,
        relatedEntityType: "tenancy",
        status: "completed",
        subject: `Tenancy updated to ${titleCase(nextTenancyStatus)}`,
        type: "internalNote",
      }, context, "ACT");
      await writeAuditLog(context, "rental.statusChange", "rentalTenancies", id, nextPayload);
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: `Tenancy updated to ${titleCase(nextTenancyStatus)}` });
      setStatusNote("");
      setSuccess("Rental status updated.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update rental status.");
    } finally {
      setSaving(null);
    }
  }

  async function handleRenewalTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to schedule renewal work.");
      return;
    }

    if (!renewalDueAt) {
      setError("Choose a renewal task due date.");
      return;
    }

    setSaving("renewal");
    setError(null);
    setSuccess(null);
    try {
      const taskId = await createOrgRecord("tasks", {
        assignedTo: context.userId,
        description: `Review renewal for ${String(record.tenantName ?? "tenant")} at ${String(record.propertyName ?? record.unitName ?? "rental property")}. Lease ends ${dateDisplay(record.leaseEndDate)}.`,
        dueAt: renewalDueAt,
        estimatedDurationMinutes: 45,
        expectedOutcome: "Confirm renewal, move-out, replacement tenant, or payment action before the lease expires.",
        location: [record.propertyName, record.unitName].filter(Boolean).join(" - "),
        priority: "high",
        reminderMinutesBefore: 1440,
        relatedEntityId: id,
        relatedEntityType: "tenancy",
        status: "notStarted",
        title: `Renewal review: ${String(record.tenantName ?? record.referenceNumber ?? "Rental")}`,
      }, context, "TASK");
      await updateOrgRecord("rentalTenancies", id, { renewalNoticeDate: renewalDueAt, status: leaseDaysLeft !== null && leaseDaysLeft <= 60 ? "renewalDue" : record.status }, context);
      await writeAuditLog(context, "task.create", "tasks", taskId, { relatedEntityId: id, title: `Renewal review: ${String(record.tenantName ?? record.referenceNumber ?? "Rental")}` });
      setSuccess("Renewal task created.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create renewal task.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Rental Operations</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Track rent, renewal, agreement, and tenant follow-up from one tenancy view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(String(record.status ?? "draft"))}>{titleCase(String(record.status ?? "draft"))}</Badge>
            <Badge tone={statusTone(String(record.paymentStatus ?? "notInvoiced"))}>{titleCase(String(record.paymentStatus ?? "notInvoiced"))}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Home, label: "Tenant", value: String(record.tenantName ?? "Not linked") },
              { icon: Building2, label: "Property", value: String(record.unitName ?? record.propertyName ?? "Not linked") },
              { icon: Banknote, label: "Rent", value: `${formatCurrency(rentAmount)} · ${titleCase(String(record.paymentCycle ?? ""))}` },
              { icon: ReceiptText, label: "Total paid", value: formatCurrency(totalPaid) },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="rounded-md border bg-white p-3" key={item.label}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 truncate text-lg font-semibold">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Next rent due</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.nextRentDueDate)}</p>
              <p className={cn("mt-1 text-xs", rentDaysLeft !== null && rentDaysLeft < 0 ? "text-destructive" : "text-muted-foreground")}>
                {rentDaysLeft === null ? "No due date set" : rentDaysLeft < 0 ? `${Math.abs(rentDaysLeft)} days overdue` : `${rentDaysLeft} days left`}
              </p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Lease ends</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.leaseEndDate)}</p>
              <p className={cn("mt-1 text-xs", leaseDaysLeft !== null && leaseDaysLeft <= 60 ? "text-warning" : "text-muted-foreground")}>
                {leaseDaysLeft === null ? "No lease end set" : leaseDaysLeft < 0 ? `${Math.abs(leaseDaysLeft)} days expired` : `${leaseDaysLeft} days left`}
              </p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Renewal tasks</p>
              <p className="mt-1 text-lg font-semibold">{renewalTasks.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dateDisplay(record.renewalNoticeDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handlePaymentSubmit}>
              <Field label="Amount">
                <Input disabled={!canUpdateRental} min={0} type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </Field>
              <Field label="Payment date">
                <Input disabled={!canUpdateRental} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </Field>
              <Field label="Method">
                <Select disabled={!canUpdateRental} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as (typeof paymentMethods)[number])}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{titleCase(method)}</option>)}
                </Select>
              </Field>
              <Field label="Reference">
                <Input disabled={!canUpdateRental} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
              </Field>
              <Field label="Note">
                <Textarea disabled={!canUpdateRental} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canUpdateRental || !canCreateActivity || saving === "payment"} type="submit">
                <Banknote className="h-4 w-4" />
                {saving === "payment" ? "Recording" : "Record payment"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status Control</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleStatusSubmit}>
              <Field label="Tenancy status">
                <Select disabled={!canUpdateRental} value={nextTenancyStatus} onChange={(event) => setNextTenancyStatus(event.target.value)}>
                  {rentalTenancyStatusOptions.map((statusOption) => <option key={statusOption} value={statusOption}>{titleCase(statusOption)}</option>)}
                </Select>
              </Field>
              <Field label="Payment status">
                <Select disabled={!canUpdateRental} value={nextPaymentStatus} onChange={(event) => setNextPaymentStatus(event.target.value)}>
                  {rentalPaymentStatusOptions.map((statusOption) => <option key={statusOption} value={statusOption}>{titleCase(statusOption)}</option>)}
                </Select>
              </Field>
              <Field label="Update note">
                <Textarea disabled={!canUpdateRental} value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canUpdateRental || !canCreateActivity || saving === "status"} type="submit" variant="secondary">
                <Send className="h-4 w-4" />
                {saving === "status" ? "Updating" : "Update status"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Renewal Follow-up</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleRenewalTaskSubmit}>
              <Field label="Task due date">
                <Input disabled={!canCreateTask} type="date" value={renewalDueAt} onChange={(event) => setRenewalDueAt(event.target.value)} />
              </Field>
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Lease ends {dateDisplay(record.leaseEndDate)}. Create a task before expiry so renewal, move-out, or replacement tenant work is not missed.
              </div>
              <Button className="h-11" disabled={!canCreateTask || !canUpdateRental || saving === "renewal"} type="submit" variant="outline">
                <FileClock className="h-4 w-4" />
                {saving === "renewal" ? "Creating" : "Create renewal task"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {paymentHistory.length ? paymentHistory.slice(0, 6).map((entry, index) => {
              const item = entry as Record<string, unknown>;
              return (
                <div className="rounded-md border p-3" key={`${String(item.at)}-${index}`}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{formatCurrency(Number(item.amount ?? 0))}</span>
                    <span className="text-xs text-muted-foreground">{dateDisplay(item.at)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{titleCase(String(item.method ?? "payment"))}{item.reference ? ` · ${String(item.reference)}` : ""}</p>
                  {item.note ? <p className="mt-1 text-muted-foreground">{String(item.note)}</p> : null}
                </div>
              );
            }) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No rent payments have been recorded yet.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Rental Activity</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {activities.length ? activities.slice(0, 6).map((activity) => (
              <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                  <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No rental activity has been logged yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LeadJourneyPanel({
  activities,
  id,
  onChanged,
  record,
  tasks,
}: {
  activities: Record<string, unknown>[];
  id: string;
  onChanged: () => Promise<void>;
  record: Record<string, unknown>;
  tasks: Record<string, unknown>[];
}) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [stageStatus, setStageStatus] = useState(String(record.status ?? "new"));
  const [stageNote, setStageNote] = useState("");
  const [lostReason, setLostReason] = useState(String(record.lostReason ?? ""));
  const [interactionType, setInteractionType] = useState<(typeof interactionTypes)[number]>("phoneCall");
  const [interactionSubject, setInteractionSubject] = useState("");
  const [interactionBody, setInteractionBody] = useState("");
  const [emailRecipient, setEmailRecipient] = useState(String(record.email ?? ""));
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState("medium");
  const [saving, setSaving] = useState<"stage" | "interaction" | "email" | "task" | null>(null);
  const [calendarPrompt, setCalendarPrompt] = useState<{ dueAt: string; taskId: string; title: string } | null>(null);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentStatus = String(record.status ?? "new");
  const currentStageIndex = leadJourneyStages.findIndex((stage) => stage.key === currentStatus);
  const openTasks = tasks.filter(isOpenTask);
  const context = user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null;
  const canUpdateLead = hasAnyPermission(member, ["leads.assign", "leads.updateAssigned"]);
  const canCreateActivity = hasPermission(member, "activities.create");
  const canCreateDeal = hasPermission(member, "deals.create");
  const canCreateTask = hasPermission(member, "tasks.create");
  const canSendEmail = canCreateActivity && currentStatus !== "converted" && currentStatus !== "lost";

  useEffect(() => {
    if (success) {
      toast({ title: "Sales journey updated", description: success, variant: "success" });
    }
  }, [success, toast]);

  useEffect(() => {
    if (error) {
      toast({ title: "Sales journey action failed", description: error, variant: "error" });
    }
  }, [error, toast]);

  async function handleStageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to update the journey.");
      return;
    }

    if (stageStatus === "converted") {
      setError("Use Convert when the lead has made a confirmed business commitment.");
      return;
    }

    if (!stageNote.trim()) {
      setError("Add a short note so the stage change has context.");
      return;
    }

    if (stageStatus === "lost" && !lostReason.trim()) {
      setError("Choose or enter a lost reason before closing the lead as lost.");
      return;
    }

    const stageHistory = Array.isArray(record.stageHistory) ? record.stageHistory : [];
    const nextPayload: Record<string, unknown> = {
      lostReason: stageStatus === "lost" ? lostReason : "",
      stageHistory: [
        ...stageHistory,
        {
          at: new Date().toISOString(),
          from: currentStatus,
          note: stageNote.trim(),
          reason: stageStatus === "lost" ? lostReason : "",
          to: stageStatus,
          userId: context.userId,
        },
      ],
      status: stageStatus,
    };

    if (["contacted", "qualified", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "lost"].includes(stageStatus)) {
      nextPayload.lastContactAt = new Date().toISOString();
    }

    setSaving("stage");
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord("leads", id, nextPayload, context);
      const activityId = await createOrgRecord("activities", {
        body: stageNote.trim(),
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "completed",
        subject: `Stage changed to ${titleCase(stageStatus)}`,
        type: stageStatus === "lost" ? "internalNote" : "followUp",
      }, context, "ACT");
      await writeAuditLog(context, "lead.stageChange", "leads", id, nextPayload);
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: `Stage changed to ${titleCase(stageStatus)}` });
      setStageNote("");
      if (stageStatus === "lost") {
        setLostReason(lostReason);
      }
      setSuccess("Sales journey updated.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update sales journey.");
    } finally {
      setSaving(null);
    }
  }

  async function handleInteractionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to log an interaction.");
      return;
    }

    if (!interactionSubject.trim()) {
      setError("Add an interaction subject.");
      return;
    }

    setSaving("interaction");
    setError(null);
    setSuccess(null);
    try {
      const activityId = await createOrgRecord("activities", {
        body: interactionBody.trim(),
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "completed",
        subject: interactionSubject.trim(),
        type: interactionType,
      }, context, "ACT");

      const nextLeadUpdate: Record<string, unknown> = { lastContactAt: new Date().toISOString() };
      if (currentStatus === "new" && interactionType !== "internalNote") {
        nextLeadUpdate.status = "contacted";
        setStageStatus("contacted");
        nextLeadUpdate.stageHistory = [
          ...(Array.isArray(record.stageHistory) ? record.stageHistory : []),
          {
            at: new Date().toISOString(),
            from: "new",
            note: interactionSubject.trim(),
            to: "contacted",
            userId: context.userId,
          },
        ];
      }

      await updateOrgRecord("leads", id, nextLeadUpdate, context);
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: interactionSubject.trim() });
      setInteractionSubject("");
      setInteractionBody("");
      setSuccess("Interaction logged.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to log interaction.");
    } finally {
      setSaving(null);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to send email.");
      return;
    }

    if (!emailRecipient.trim()) {
      setError("This lead does not have an email address.");
      return;
    }

    if (!emailSubject.trim()) {
      setError("Add an email subject.");
      return;
    }

    if (!emailBody.trim()) {
      setError("Add an email message.");
      return;
    }

    setSaving("email");
    setError(null);
    setSuccess(null);
    try {
      await sendSalesJourneyEmail({
        body: emailBody.trim(),
        leadId: id,
        organizationId: activeOrganizationId,
        recipient: emailRecipient.trim(),
        subject: emailSubject.trim(),
      });
      if (currentStatus === "new") {
        setStageStatus("contacted");
      }
      const message = `Email sent to ${emailRecipient.trim()}.`;
      setEmailSubject("");
      setEmailBody("");
      setSuccess(message);
      await onChanged();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to send email.";
      setError(message);
    } finally {
      setSaving(null);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to create a follow-up.");
      return;
    }

    if (!followUpTitle.trim()) {
      setError("Add a follow-up title.");
      return;
    }

    setSaving("task");
    setError(null);
    setSuccess(null);
    try {
      const taskId = await createOrgRecord("tasks", {
        assignedTo: String(record.assignedTo ?? context.userId),
        description: `Lead follow-up for ${String(record.fullName ?? record.referenceNumber ?? id)}`,
        dueAt: followUpDueAt || "",
        estimatedDurationMinutes: 30,
        expectedOutcome: "Contact the lead, record the outcome, and move the sales journey to the next accurate stage.",
        location: String(record.geoAddress ?? record.preferredLocation ?? record.city ?? record.state ?? ""),
        priority: followUpPriority,
        reminderMinutesBefore: 60,
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "notStarted",
        title: followUpTitle.trim(),
      }, context, "TASK");

      await updateOrgRecord("leads", id, { nextFollowUpAt: followUpDueAt || "" }, context);
      await writeAuditLog(context, "task.create", "tasks", taskId, { relatedEntityId: id, title: followUpTitle.trim() });
      if (followUpDueAt) {
        setCalendarPrompt({ dueAt: followUpDueAt, taskId, title: followUpTitle.trim() });
      } else {
        setCalendarPrompt(null);
      }
      setFollowUpTitle("");
      setFollowUpDueAt("");
      setSuccess("Follow-up task created.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create follow-up task.");
    } finally {
      setSaving(null);
    }
  }

  async function syncCalendarFromPrompt() {
    setCalendarSyncing(true);
    try {
      const copied = await openGoogleCalendarSettings(user, toast);
      if (copied) {
        setCalendarPrompt(null);
      }
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to open Google Calendar settings.";
      toast({ title: "Unable to sync calendar", description: message, variant: "error" });
    } finally {
      setCalendarSyncing(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Sales Journey</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">A lead becomes a client only after conversion at Closed Won.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(currentStatus)}>{titleCase(currentStatus)}</Badge>
            <Badge tone={openTasks.length ? "warning" : "muted"}>{openTasks.length} open follow-up{openTasks.length === 1 ? "" : "s"}</Badge>
            {canCreateDeal && ["qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "converted"].includes(currentStatus) ? (
              <ButtonLink href={`/deals/new?leadId=${id}`} size="sm" variant="outline">
                <Handshake className="h-4 w-4" />
                Open deal
              </ButtonLink>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {leadJourneyStages.map((stage, index) => {
              const isDone = currentStatus === "converted" || currentStatus === "lost" || (currentStageIndex >= 0 && index < currentStageIndex);
              const isCurrent = stage.key === currentStatus;
              return (
                <div className={cn("rounded-md border p-3", isCurrent ? "border-primary bg-primary/5" : isDone ? "border-success/30 bg-success/5" : "bg-white")} key={stage.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.description}</p>
                </div>
              );
            })}
            {terminalLeadStages.map((stage) => {
              const Icon = stage.icon;
              const active = currentStatus === stage.key;
              return (
                <div className={cn("rounded-md border p-3", active ? stage.key === "converted" ? "border-success bg-success/5" : "border-destructive bg-destructive/5" : "bg-white")} key={stage.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <Icon className={cn("h-4 w-4", active ? stage.key === "converted" ? "text-success" : "text-destructive" : "text-muted-foreground")} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.key === "converted" ? "Confirmed commitment, payment, reservation, or approved conversion." : "Lead is closed with a clear reason and note."}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Lead value</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(Number(record.budgetMaximum ?? record.budgetMinimum ?? 0))}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Last contact</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.lastContactAt)}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Next follow-up</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.nextFollowUpAt)}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Temperature</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold"><Flame className="h-4 w-4 text-warning" /> {titleCase(String(record.leadTemperature ?? "warm"))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}
      {calendarPrompt ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-foreground">Sync this follow-up with your calendar?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {calendarPrompt.title} is dated {formatDate(calendarPrompt.dueAt)}. Connect Google once and assigned dated tasks will sync automatically.
              </p>
            </div>
            <div className="grid gap-2 sm:flex">
              <Button disabled={calendarSyncing} onClick={() => void syncCalendarFromPrompt()} type="button" variant="secondary">
                <CalendarClock className="h-4 w-4" />
                {calendarSyncing ? "Preparing" : "Sync with calendar"}
              </Button>
              <ButtonLink href={`/tasks/${calendarPrompt.taskId}`} variant="outline">View task</ButtonLink>
              <Button onClick={() => setCalendarPrompt(null)} type="button" variant="ghost">Later</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Move Stage</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleStageSubmit}>
              <Field label="Next stage">
                <Select disabled={!canUpdateLead || currentStatus === "converted"} value={stageStatus} onChange={(event) => setStageStatus(event.target.value)}>
                  {[...leadJourneyStages, { description: "", key: "lost", label: "Closed lost" }].map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
                </Select>
              </Field>
              {stageStatus === "lost" ? (
                <Field label="Lost reason">
                  <Select disabled={!canUpdateLead} value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                    <option value="">Select lost reason</option>
                    {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Stage note">
                <Textarea disabled={!canUpdateLead || currentStatus === "converted"} placeholder="What happened, what changed, or what should happen next?" value={stageNote} onChange={(event) => setStageNote(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canUpdateLead || currentStatus === "converted" || saving === "stage"} type="submit">
                <Send className="h-4 w-4" />
                {saving === "stage" ? "Updating" : "Update stage"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Log Interaction</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleInteractionSubmit}>
              <Field label="Interaction type">
                <Select disabled={!canCreateActivity || currentStatus === "converted"} value={interactionType} onChange={(event) => setInteractionType(event.target.value as (typeof interactionTypes)[number])}>
                  {interactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </Select>
              </Field>
              <Field label="Subject">
                <Input disabled={!canCreateActivity || currentStatus === "converted"} value={interactionSubject} onChange={(event) => setInteractionSubject(event.target.value)} />
              </Field>
              <Field label="Details">
                <Textarea disabled={!canCreateActivity || currentStatus === "converted"} value={interactionBody} onChange={(event) => setInteractionBody(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canCreateActivity || currentStatus === "converted" || saving === "interaction"} type="submit" variant="secondary">
                <PhoneCall className="h-4 w-4" />
                {saving === "interaction" ? "Logging" : "Log interaction"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Send Email</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleEmailSubmit}>
              <Field label="Recipient">
                <Input disabled={!canSendEmail} placeholder="client@example.com" type="email" value={emailRecipient} onChange={(event) => setEmailRecipient(event.target.value)} />
              </Field>
              <Field label="Subject">
                <Input disabled={!canSendEmail || !emailRecipient} placeholder="Property recommendation, inspection details..." value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
              </Field>
              <Field label="Message">
                <Textarea disabled={!canSendEmail || !emailRecipient} placeholder="Write the message that should be sent to this lead." value={emailBody} onChange={(event) => setEmailBody(event.target.value)} />
              </Field>
              {!record.email ? <p className="text-xs text-muted-foreground">Add an email address to this lead before sending email.</p> : null}
              <Button className="h-11" disabled={!canSendEmail || !emailRecipient || saving === "email"} type="submit" variant="outline">
                <Mail className="h-4 w-4" />
                {saving === "email" ? "Sending" : "Send email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next Action</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleTaskSubmit}>
              <Field label="Follow-up title">
                <Input disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} placeholder="Call back, send proposal, book inspection..." value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} />
              </Field>
              <Field label="Due date">
                <Input disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} type="date" value={followUpDueAt} onChange={(event) => setFollowUpDueAt(event.target.value)} />
              </Field>
              <Field label="Priority">
                <Select disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} value={followUpPriority} onChange={(event) => setFollowUpPriority(event.target.value)}>
                  {["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
                </Select>
              </Field>
              <Button className="h-11" disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost" || saving === "task"} type="submit" variant="outline">
                <CalendarClock className="h-4 w-4" />
                {saving === "task" ? "Creating" : "Create follow-up"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Journey History</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {Array.isArray(record.stageHistory) && record.stageHistory.length ? record.stageHistory.slice().reverse().map((entry, index) => {
            const item = entry as Record<string, unknown>;
            return (
              <div className="rounded-md border p-3" key={`${String(item.at)}-${index}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{titleCase(String(item.from ?? "new"))} to {titleCase(String(item.to ?? currentStatus))}</span>
                  <span className="text-xs text-muted-foreground">{dateDisplay(item.at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{String(item.note ?? "No note")}</p>
                {item.reason ? <p className="mt-1 text-xs font-medium text-destructive">Reason: {String(item.reason)}</p> : null}
              </div>
            );
          }) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No stage changes have been recorded yet.</div>}
          {activities.length ? activities.slice(0, 3).map((activity) => (
            <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
            </Link>
          )) : null}
        </CardContent>
      </Card>
    </div>
  );
}

type FixedFilter = { field: string; value: string };

const availableUnitStatuses = ["available", "vacant"];
const reservedUnitStatuses = ["reserved", "underNegotiation"];
const closedUnitStatuses = ["sold", "rented", "leased", "occupied"];
const unavailableUnitStatuses = ["unavailable", "withdrawn", "underMaintenance"];

function countUnitsByStatus(records: Record<string, unknown>[], statuses: string[]) {
  return records.filter((record) => statuses.includes(String(record.status ?? ""))).length;
}

function UnitInventoryOverview({ records }: { records: Record<string, unknown>[] }) {
  const availableCount = countUnitsByStatus(records, availableUnitStatuses);
  const reservedCount = countUnitsByStatus(records, reservedUnitStatuses);
  const closedCount = countUnitsByStatus(records, closedUnitStatuses);
  const unavailableCount = countUnitsByStatus(records, unavailableUnitStatuses);
  const groupedByProperty = Array.from(records.reduce((groups, record) => {
    const propertyId = String(record.propertyId ?? "unlinked");
    const current = groups.get(propertyId) ?? {
      available: 0,
      closed: 0,
      id: propertyId,
      label: String(record.propertyName ?? record.propertyReferenceNumber ?? record.propertyId ?? "Unlinked property"),
      reserved: 0,
      total: 0,
    };
    const status = String(record.status ?? "");
    current.total += 1;
    if (availableUnitStatuses.includes(status)) {
      current.available += 1;
    }
    if (reservedUnitStatuses.includes(status)) {
      current.reserved += 1;
    }
    if (closedUnitStatuses.includes(status)) {
      current.closed += 1;
    }
    groups.set(propertyId, current);
    return groups;
  }, new Map<string, { available: number; closed: number; id: string; label: string; reserved: number; total: number }>()).values())
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const summaryCards = [
    { icon: Building2, label: "Total units", tone: "text-foreground", value: records.length },
    { icon: CircleCheck, label: "Available", tone: "text-success", value: availableCount },
    { icon: Clock, label: "Reserved/negotiating", tone: "text-warning", value: reservedCount },
    { icon: XCircle, label: "Closed or unavailable", tone: "text-muted-foreground", value: closedCount + unavailableCount },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </div>
                <Icon className={cn("h-5 w-5", item.tone)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle>Inventory By Property</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {groupedByProperty.map((property) => (
            <Link className="grid gap-3 rounded-md border p-3 hover:bg-muted md:grid-cols-[minmax(0,1fr)_auto]" href={property.id === "unlinked" ? "/units" : `/properties/${property.id}/units`} key={property.id}>
              <div className="min-w-0">
                <p className="truncate font-semibold">{property.label}</p>
                <p className="mt-1 text-muted-foreground">{property.total} total units</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-success/10 px-3 py-2 text-success">
                  <p className="font-semibold">{property.available}</p>
                  <p className="text-xs">Available</p>
                </div>
                <div className="rounded-md bg-warning/10 px-3 py-2 text-warning">
                  <p className="font-semibold">{property.reserved}</p>
                  <p className="text-xs">Held</p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                  <p className="font-semibold">{property.closed}</p>
                  <p className="text-xs">Closed</p>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BulkEmailPanel({
  collection,
  onClose,
  organizationId,
  records,
}: {
  collection: "clients" | "leads";
  onClose: () => void;
  organizationId: string;
  records: Record<string, unknown>[];
}) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const eligibleRecords = useMemo(() => records
    .filter((record) => typeof record.id === "string" && typeof record.email === "string" && Boolean(record.email.trim()))
    .slice(0, 50), [records]);
  const recipientType = collection === "clients" ? "client" : "lead";

  const eligibleIds = useMemo(() => new Set(eligibleRecords.map((record) => String(record.id))), [eligibleRecords]);
  const activeSelectedIds = useMemo(() => selectedIds.filter((id) => eligibleIds.has(id)), [eligibleIds, selectedIds]);
  const allSelected = Boolean(eligibleRecords.length) && activeSelectedIds.length === eligibleRecords.length;

  function toggleRecipient(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSelectedIds.length) {
      toast({ title: "Select recipients", description: "Choose at least one recipient with an email address.", variant: "error" });
      return;
    }

    if (!subject.trim()) {
      toast({ title: "Add a subject", variant: "error" });
      return;
    }

    if (!body.trim()) {
      toast({ title: "Add a message", variant: "error" });
      return;
    }

    setSending(true);
    try {
      const result = await sendBulkSalesEmail({
        body: body.trim(),
        organizationId,
        recipientIds: activeSelectedIds,
        recipientType,
        subject: subject.trim(),
      });
      const detail = [
        `${result.sent.length} sent`,
        result.skipped.length ? `${result.skipped.length} skipped` : "",
        result.failed.length ? `${result.failed.length} failed` : "",
      ].filter(Boolean).join(", ");

      if (result.sent.length) {
        toast({ title: "Bulk email complete", description: detail, variant: result.failed.length ? "info" : "success" });
        setBody("");
        setSubject("");
        setSelectedIds([]);
      } else {
        const reason = result.failed[0]?.reason ?? result.skipped[0]?.reason ?? "No emails were sent.";
        toast({ title: "No emails sent", description: reason, variant: "error" });
      }
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to send bulk email.";
      toast({ title: "Unable to send bulk email", description: message, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Bulk Email</CardTitle>
          <Button className="h-10 w-full md:w-auto" onClick={onClose} type="button" variant="ghost">Close</Button>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3">
              <Field label="Subject">
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </Field>
              <Field label="Message">
                <Textarea className="min-h-36" value={body} onChange={(event) => setBody(event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Recipients</p>
                <Button
                  className="h-9"
                  disabled={!eligibleRecords.length}
                  onClick={() => setSelectedIds(allSelected ? [] : eligibleRecords.map((record) => String(record.id)))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {allSelected ? "Clear" : "Select all"}
                </Button>
              </div>
              <div className="max-h-72 overflow-auto rounded-md border bg-white">
                {eligibleRecords.length ? eligibleRecords.map((record) => {
                  const id = String(record.id);
                  const name = recordDisplayName(record);
                  return (
                    <label className="flex cursor-pointer items-start gap-3 border-b p-3 text-sm last:border-b-0 hover:bg-muted/50" key={id}>
                      <Input
                        checked={activeSelectedIds.includes(id)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                        onChange={() => toggleRecipient(id)}
                        type="checkbox"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{String(record.email)}</span>
                      </span>
                    </label>
                  );
                }) : (
                  <div className="p-3 text-sm text-muted-foreground">No email addresses available.</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{activeSelectedIds.length} of {eligibleRecords.length} selected</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button className="h-11 md:h-10" disabled={sending || !activeSelectedIds.length} type="submit">
              <Send className="h-4 w-4" />
              {sending ? "Sending" : "Send bulk email"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ModuleListPage({
  config,
  createHref,
  description,
  fixedFilters = [],
  title,
}: {
  config: ModuleConfig;
  createHref?: string;
  description?: string;
  fixedFilters?: FixedFilter[];
  title?: string;
}) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [calendarFeedLoading, setCalendarFeedLoading] = useState(false);
  const fixedFilterKey = JSON.stringify(fixedFilters);

  useEffect(() => {
    let mounted = true;
    const constraints: QueryConstraint[] = [];
    const activeFixedFilters = JSON.parse(fixedFilterKey) as FixedFilter[];

    const branchId = effectiveBranchId(member, activeBranchId);
    if (branchId) {
      constraints.push(where("branchId", "==", branchId));
    }

    if (config.collection === "leads" && user && (isAssignedOnlySalesUser(member) || !hasPermission(member, "leads.readAll"))) {
      constraints.push(where("assignedTo", "==", user.uid));
    }

    if (config.collection === "clients" && user && isAssignedOnlySalesUser(member)) {
      constraints.push(where("assignedRelationshipManager", "==", user.uid));
    }

    if (config.collection === "deals" && user && isAssignedOnlySalesUser(member)) {
      constraints.push(where("dealOwnerId", "==", user.uid));
    }

    if (config.collection === "tasks" && user && !hasAnyPermission(member, ["dashboard.viewExecutive", "users.manage"])) {
      constraints.push(where("assignedTo", "==", user.uid));
    }

    activeFixedFilters.forEach((filter) => {
      constraints.push(where(filter.field, "==", filter.value));
    });

    const shouldResolveCreators = ["leads", "clients", "deals"].includes(config.collection);
    Promise.all([
      listOrgRecords<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, constraints),
      shouldResolveCreators ? listMembers(activeOrganizationId).catch(() => [] as Member[]) : Promise.resolve([] as Member[]),
    ])
      .then(([items, nextMembers]) => {
        if (mounted) {
          const enriched = nextMembers.length
            ? items.map((item) => {
                if (item.createdByName || !item.createdBy) {
                  return item;
                }
                const creator = nextMembers.find((memberItem) => memberItem.id === item.createdBy);
                return creator ? { ...item, createdByEmail: creator.email, createdByName: creator.displayName || creator.email } : item;
              })
            : items;
          setRecords(enriched);
        }
      })
      .catch((nextError) => {
        const message = nextError instanceof Error ? nextError.message : "Unable to load records.";
        setError(message);
        toast({ title: `Unable to load ${config.title.toLowerCase()}`, description: message, variant: "error" });
      })
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [activeBranchId, activeOrganizationId, config.collection, config.title, fixedFilterKey, member, toast, user]);

  if (!hasPermission(member, config.listPermission as never)) {
    return <PermissionDenied />;
  }

  const pageDescription = description ?? (
    config.collection === "propertyUnits"
      ? "Inventory for sellable, rentable, reserved, closed, and unavailable units under properties."
      : "Search, filter, sort, export, and manage organization-scoped records."
  );
  const pageTitle = title ?? (config.collection === "propertyUnits" ? "Unit Inventory" : config.title);
  const singularTitle = moduleSingularTitle(config);
  const compactContactView = config.collection === "leads" || config.collection === "clients"
    ? {
        getHref: (row: Record<string, unknown>) => `${config.route}/${String(row.id)}`,
        getName: (row: Record<string, unknown>) => String(row.fullName ?? row.referenceNumber ?? "Unnamed"),
        getPhone: (row: Record<string, unknown>) => String(row.phoneNumber ?? row.whatsappNumber ?? ""),
      }
    : undefined;
  const canBulkEmail = (config.collection === "leads" || config.collection === "clients") && hasPermission(member, "activities.create");
  const canCreateRecord = hasPermission(member, config.createPermission as never);

  async function copyTaskCalendarFeed() {
    setCalendarFeedLoading(true);
    try {
      await openGoogleCalendarSettings(user, toast);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to open Google Calendar settings.";
      toast({ title: "Unable to open Google Calendar", description: message, variant: "error" });
    } finally {
      setCalendarFeedLoading(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
        </div>
        <div className="grid gap-2 md:flex">
          <AiGuideLink className="h-11 w-full md:h-10 md:w-auto" question={`How do I use the ${pageTitle} section in Vlingo Systems CRM? Explain what this module is for and the best workflow.`} />
          {config.collection === "tasks" ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={calendarFeedLoading} onClick={() => void copyTaskCalendarFeed()} type="button" variant="outline">
              <CalendarClock className="h-4 w-4" />
              {calendarFeedLoading ? "Opening" : "Google Calendar"}
            </Button>
          ) : null}
          {canBulkEmail ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" onClick={() => setBulkEmailOpen((value) => !value)} type="button" variant={bulkEmailOpen ? "secondary" : "outline"}>
              <Mail className="h-4 w-4" />
              Bulk email
            </Button>
          ) : null}
          {canCreateRecord ? (
            <ButtonLink className={cn("h-11 w-full md:h-10 md:w-auto", config.collection === "tasks" && "hidden lg:inline-flex")} href={createHref ?? `${config.route}/new`}>
              <Plus className="h-4 w-4" />
              New {singularTitle}
            </ButtonLink>
          ) : null}
        </div>
      </div>
      {config.collection === "propertyUnits" && !error && !loading && records.length ? <UnitInventoryOverview records={records} /> : null}
      {bulkEmailOpen && canBulkEmail && (config.collection === "leads" || config.collection === "clients") ? (
        <BulkEmailPanel collection={config.collection} onClose={() => setBulkEmailOpen(false)} organizationId={activeOrganizationId} records={records} />
      ) : null}
      {error ? <ErrorState message={error} /> : loading ? <LoadingState label={`Loading ${config.title.toLowerCase()}`} /> : (
        <CrmTable compactContactView={compactContactView} columns={columnsFor(config.collection)} data={records} emptyActionHref={`${config.route}/new`} emptyActionLabel={`Create ${singularTitle}`} emptyTitle={config.emptyTitle} exportFilename={`${config.collection}.csv`} />
      )}
      {config.collection === "tasks" && canCreateRecord ? (
        <ButtonLink
          aria-label="Create new task"
          className="no-print fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-20 h-12 px-4 shadow-xl md:bottom-6 md:right-6 lg:hidden"
          href={createHref ?? "/tasks/new"}
        >
          <Plus className="h-5 w-5" />
          New task
        </ButtonLink>
      ) : null}
    </section>
  );
}

export function ModuleCreatePage({ config }: { config: ModuleConfig }) {
  const { member } = useAuth();
  const searchParams = useSearchParams();
  const singularTitle = moduleSingularTitle(config);
  if (!hasPermission(member, config.createPermission as never)) {
    return <PermissionDenied />;
  }

  const initialValues = Object.fromEntries(searchParams.entries());

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Create {singularTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Validated form data writes through the organization-scoped Firestore repository.</p>
        <div className="mt-3">
          <AiGuideLink question={`Guide me step by step to create a ${singularTitle} in Vlingo Systems CRM. Explain what information I need before saving.`} />
        </div>
      </div>
      <ModuleForm config={config} initialValues={initialValues} />
    </section>
  );
}

export function ModuleDetailPage({ config, id }: { config: ModuleConfig; id: string }) {
  const router = useRouter();
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [relatedRecord, setRelatedRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activityMembers, setActivityMembers] = useState<Member[]>([]);
  const [offerings, setOfferings] = useState<Record<string, unknown>[]>([]);
  const [properties, setProperties] = useState<Record<string, unknown>[]>([]);
  const [propertyUnits, setPropertyUnits] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const branchConstraints = useMemo<QueryConstraint[]>(() => (
    effectiveBranchId(member, activeBranchId) ? [where("branchId", "==", effectiveBranchId(member, activeBranchId))] : []
  ), [activeBranchId, member]);

  useEffect(() => {
    if (actionSuccess) {
      toast({ title: "Record updated", description: actionSuccess, variant: "success" });
    }
  }, [actionSuccess, toast]);

  useEffect(() => {
    if (actionError) {
      toast({ title: "Record action failed", description: actionError, variant: "error" });
    }
  }, [actionError, toast]);

  const loadDetail = useCallback(async () => {
    const relatedType = relatedTypeForCollection(config.collection);
    const [nextRecord, nextTasks, nextActivities, nextDocuments, nextProperties, nextPropertyUnits, nextOfferings, nextMembers] = await Promise.all([
      getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id),
      safeListOrgRecords(activeOrganizationId, "tasks", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "activities", branchConstraints),
      safeListDocuments(activeOrganizationId, branchConstraints),
      safeListOrgRecords(activeOrganizationId, "properties", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "propertyUnits", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "offerings", branchConstraints),
      shouldResolveUserSnapshots(config.collection) ? safeListMembers(activeOrganizationId) : Promise.resolve([]),
    ]);
    const resolvedRecord = enrichCreatorSnapshot(nextRecord, nextMembers);
    const nextRelatedRecord = config.collection === "activities"
      ? await safeGetRelatedRecord(activeOrganizationId, resolvedRecord)
      : config.collection === "propertyUnits"
        ? await safeGetLinkedProperty(activeOrganizationId, resolvedRecord)
        : null;
    setRecord(resolvedRecord);
    setRelatedRecord(nextRelatedRecord);
    setActivityMembers(nextMembers);
    setOfferings(config.collection === "leads" ? nextOfferings : []);
    setProperties(config.collection === "leads" ? nextProperties : []);
    setPropertyUnits(config.collection === "properties" ? nextPropertyUnits.filter((item) => item.propertyId === id).slice(0, 8) : config.collection === "leads" ? nextPropertyUnits : []);
    if (relatedType) {
      setTasks(nextTasks.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 8));
      setActivities(nextActivities.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 10));
      setDocuments(nextDocuments.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
    }
  }, [activeOrganizationId, branchConstraints, config.collection, id]);

  useEffect(() => {
    let mounted = true;
    const relatedType = relatedTypeForCollection(config.collection);

    Promise.all([
      getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id),
      safeListOrgRecords(activeOrganizationId, "tasks", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "activities", branchConstraints),
      safeListDocuments(activeOrganizationId, branchConstraints),
      safeListOrgRecords(activeOrganizationId, "properties", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "propertyUnits", branchConstraints),
      safeListOrgRecords(activeOrganizationId, "offerings", branchConstraints),
      shouldResolveUserSnapshots(config.collection) ? safeListMembers(activeOrganizationId) : Promise.resolve([]),
    ])
      .then(async ([nextRecord, nextTasks, nextActivities, nextDocuments, nextProperties, nextPropertyUnits, nextOfferings, nextMembers]) => {
        if (!mounted) {
          return;
        }

        const resolvedRecord = enrichCreatorSnapshot(nextRecord, nextMembers);
        const nextRelatedRecord = config.collection === "activities"
          ? await safeGetRelatedRecord(activeOrganizationId, resolvedRecord)
          : config.collection === "propertyUnits"
            ? await safeGetLinkedProperty(activeOrganizationId, resolvedRecord)
            : null;
        if (!mounted) {
          return;
        }

        setRecord(resolvedRecord);
        setRelatedRecord(nextRelatedRecord);
        setActivityMembers(nextMembers);
        setOfferings(config.collection === "leads" ? nextOfferings : []);
        setProperties(config.collection === "leads" ? nextProperties : []);
        setPropertyUnits(config.collection === "properties" ? nextPropertyUnits.filter((item) => item.propertyId === id).slice(0, 8) : config.collection === "leads" ? nextPropertyUnits : []);
        if (relatedType) {
          setTasks(nextTasks.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 8));
          setActivities(nextActivities.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 10));
          setDocuments(nextDocuments.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, branchConstraints, config.collection, id]);

  if (!hasPermission(member, config.listPermission as never)) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading record" />;
  }

  if (!record) {
    return <ErrorState message="Record not found." />;
  }

  const status = String(record.status ?? record.propertyStatus ?? "active");
  const relatedType = relatedTypeForCollection(config.collection);
  const relatedQuery = relatedType ? `relatedEntityType=${relatedType}&relatedEntityId=${id}` : "";
  const relatedRecordHref = relatedRecord ? routeForRelatedEntity(config.collection === "propertyUnits" ? "property" : record.relatedEntityType, relatedRecord.id) : null;
  const relatedRecordLabel = config.collection === "propertyUnits" ? "Property" : titleCase(String(record.relatedEntityType ?? "Related record"));
  const canAttachDocuments = hasAnyPermission(member, documentAccessPermissions);
  const canCreateTask = hasPermission(member, "tasks.create");
  const canCreateActivity = hasPermission(member, "activities.create");
  const canDeleteLead = config.collection === "leads" && memberRoles(member).includes("superAdmin");

  async function handleConvertLead() {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await convertLeadToClient(activeOrganizationId, id);
      setActionSuccess("Lead converted to client.");
      router.push(`/clients/${result.clientId}`);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Unable to convert lead.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteLead() {
    const currentRecord = record;
    if (!currentRecord) {
      setActionError("Lead record is not loaded.");
      return;
    }

    if (!user) {
      setActionError("You must be signed in to delete a lead.");
      return;
    }

    const confirmed = window.confirm("Delete this lead? This will remove it from lead lists and dashboards, but keep an audit trail.");
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const context = {
        branchId: String(currentRecord.branchId ?? activeBranchId),
        organizationId: activeOrganizationId,
        userEmail: user.email ?? member?.email,
        userId: user.uid,
        userName: member?.displayName ?? user.displayName ?? undefined,
      };
      await softDeleteOrgRecord("leads", id, context);
      await writeAuditLog(context, "lead.delete", "leads", id, { leadId: id, fullName: currentRecord.fullName ?? null, referenceNumber: currentRecord.referenceNumber ?? null });
      toast({ title: "Lead deleted", description: "The lead was removed from active records.", variant: "success" });
      router.push("/leads");
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Unable to delete lead.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSyncTaskCalendar() {
    if (!record?.dueAt) {
      toast({ title: "Task needs a due date", description: "Add a due date before syncing this task to Google Calendar.", variant: "error" });
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await openGoogleCalendarSettings(user, toast);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to open Google Calendar settings.";
      setActionError(message);
      toast({ title: "Unable to sync calendar", description: message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-start md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{String(record.fullName ?? record.tenantName ?? record.name ?? record.title ?? record.subject ?? record.unitNumber ?? "Record")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{String(record.referenceNumber ?? id)} · {status}</p>
        </div>
        <div className="grid gap-2 md:flex">
          <AiGuideLink className="h-11 w-full md:h-10 md:w-auto" question={`What should I do next on this ${moduleSingularTitle(config)} record in Vlingo Systems CRM? Explain the best workflow and related actions.`} />
          {config.collection === "leads" && hasPermission(member, "clients.create") && status !== "converted" && status !== "lost" ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={actionLoading} onClick={handleConvertLead} type="button" variant="secondary">
              <Repeat2 className="h-4 w-4" />
              Convert to client
            </Button>
          ) : null}
          {hasPermission(member, config.editPermission as never) ? <ButtonLink className="h-11 w-full md:h-10 md:w-auto" href={`${config.route}/${id}/edit`} variant="outline">Edit record</ButtonLink> : null}
          {config.collection === "tasks" ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={actionLoading} onClick={() => void handleSyncTaskCalendar()} type="button" variant="secondary">
              <CalendarClock className="h-4 w-4" />
              Sync calendar
            </Button>
          ) : null}
          {canDeleteLead ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={actionLoading} onClick={handleDeleteLead} type="button" variant="danger">
              <Trash2 className="h-4 w-4" />
              Delete lead
            </Button>
          ) : null}
        </div>
      </div>
      {actionError ? <ErrorState message={actionError} /> : null}
      {actionSuccess ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {actionSuccess}
        </div>
      ) : null}
      {relatedType ? (
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          {canCreateTask ? (
            <ButtonLink href={`/tasks/new?${relatedQuery}`} variant="outline">
              <ListTodo className="h-4 w-4" />
              Add task
            </ButtonLink>
          ) : null}
          {canCreateActivity ? (
            <ButtonLink href={`/activities/new?${relatedQuery}`} variant="outline">
              <MessageSquarePlus className="h-4 w-4" />
              Log activity
            </ButtonLink>
          ) : null}
          {canAttachDocuments ? (
            <ButtonLink href={`/documents?${relatedQuery}`} variant="outline">
              <GitBranch className="h-4 w-4" />
              Attach document
            </ButtonLink>
          ) : null}
          {config.collection === "deals" && hasPermission(member, "finance.create") ? (
            <ButtonLink href={`/finance?source=deal:${id}`} variant="outline">
              <ReceiptText className="h-4 w-4" />
              Create receipt
            </ButtonLink>
          ) : null}
          {config.collection === "properties" && hasPermission(member, "units.create") ? (
            <ButtonLink href={`/units/new?propertyId=${id}`} variant="outline">
              <Building2 className="h-4 w-4" />
              Add unit
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      {config.collection === "leads" ? (
        <LeadJourneyPanel activities={activities} id={id} onChanged={loadDetail} record={record} tasks={tasks} />
      ) : null}
      {config.collection === "leads" ? (
        <LeadOfferingPanel offerings={offerings} properties={properties} propertyUnits={propertyUnits} record={record} />
      ) : null}
      {config.collection === "developmentProjects" ? (
        <DevelopmentOperationsPanel activities={activities} id={id} onChanged={loadDetail} record={record} tasks={tasks} />
      ) : null}
      {config.collection === "rentalTenancies" ? (
        <RentalOperationsPanel activities={activities} id={id} onChanged={loadDetail} record={record} tasks={tasks} />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {(config.collection === "activities" || config.collection === "propertyUnits") && relatedRecord ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{relatedRecordLabel}</span>
                {relatedRecordHref ? (
                  <Link className="max-w-48 truncate font-medium text-primary" href={relatedRecordHref}>{recordDisplayName(relatedRecord)}</Link>
                ) : (
                  <span className="max-w-48 truncate font-medium">{recordDisplayName(relatedRecord)}</span>
                )}
              </div>
            ) : null}
            {recordSummaryEntries(record, config.collection).map(({ key, label, value }) => (
              <div className="flex justify-between gap-4" key={key}>
                <span className="text-muted-foreground">{label}</span>
                {recordValueDisplay(record, key, value, config.collection, activityMembers)}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {activities.length ? activities.map((activity) => (
              <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                  <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4">No timeline entries yet.</div>}
          </CardContent>
        </Card>
      </div>
      {config.collection === "properties" ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Units</CardTitle>
              <div className="grid gap-2 sm:flex">
                <ButtonLink href={`/properties/${id}/units`} size="sm" variant="outline">View all units</ButtonLink>
                {hasPermission(member, "units.create") ? <ButtonLink href={`/units/new?propertyId=${id}`} size="sm">Add unit</ButtonLink> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {propertyUnits.length ? propertyUnits.map((unit) => (
              <Link className="rounded-md border p-3 hover:bg-muted" href={`/units/${unit.id}`} key={String(unit.id)}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{String(unit.unitNumber ?? unit.referenceNumber ?? "Unit")}</span>
                  <Badge tone={statusTone(String(unit.status ?? "draft"))}>{titleCase(String(unit.status ?? "draft"))}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {String(unit.unitType ?? "Unit")} · {formatCurrency(Number(unit.askingPrice ?? unit.rentAmount ?? 0))}
                </p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No units have been linked to this property yet.</div>}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Open Tasks</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {tasks.length ? tasks.map((task) => (
              <Link className="rounded-md border p-3 hover:bg-muted" href={`/tasks/${task.id}`} key={String(task.id)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{String(task.title ?? "Task")}</span>
                  <Badge tone={statusTone(String(task.status ?? "notStarted"))}>{titleCase(String(task.status ?? "notStarted"))}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">Priority: {titleCase(String(task.priority ?? "medium"))}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No related tasks yet.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {documents.length ? documents.map((document) => (
              <a className="rounded-md border p-3 hover:bg-muted" href={document.downloadURL} key={document.id} rel="noreferrer" target="_blank">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{document.title}</span>
                  <Badge tone="muted">{titleCase(document.category)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{formatDate(document.updatedAt ?? document.createdAt)}</p>
              </a>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No attached documents yet.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ModuleEditPage({ config, id }: { config: ModuleConfig; id: string }) {
  const { activeOrganizationId, member } = useAuth();
  const singularTitle = moduleSingularTitle(config);
  const [record, setRecord] = useState<Record<string, string | number | string[] | undefined> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgRecord<Record<string, string | number | string[] | undefined> & { id: string }>(activeOrganizationId, config.collection, id)
      .then(setRecord)
      .finally(() => setLoading(false));
  }, [activeOrganizationId, config.collection, id]);

  if (!hasPermission(member, config.editPermission as never)) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading form" />;
  }

  if (!record) {
    return <ErrorState message="Record not found." />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Edit {singularTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization and audit fields are preserved by the repository and security rules.</p>
        <div className="mt-3">
          <AiGuideLink question={`Guide me step by step to edit a ${singularTitle} in Vlingo Systems CRM. Explain what fields I should review before saving.`} />
        </div>
      </div>
      <ModuleForm config={config} existing={record} id={id} />
    </section>
  );
}
