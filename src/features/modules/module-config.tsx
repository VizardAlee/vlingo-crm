import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPhone, statusTone, titleCase } from "@/lib/utils";
import type { Activity, Client, Lead, Property, PropertyUnit, Task } from "@/types/crm";

export type ModuleKey = "leads" | "clients" | "properties" | "propertyUnits" | "tasks" | "activities";

export interface FormField {
  name: string;
  label: string;
  options?: string[];
  required?: boolean;
  type: "text" | "email" | "number" | "select" | "textarea";
}

export interface ModuleConfig {
  collection: ModuleKey;
  createPermission: string;
  editPermission: string;
  emptyTitle: string;
  fields: FormField[];
  listPermission: string;
  prefix: string;
  route: string;
  title: string;
}

const leadStatuses = ["new", "contacted", "qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "converted", "lost", "dormant"];
const leadSources = ["Website", "Facebook", "Instagram", "Google Ads", "WhatsApp", "Referral", "Agent", "Walk-in", "Phone call", "Property portal", "Event", "Other"];
const propertyStatuses = ["draft", "available", "reserved", "underNegotiation", "sold", "rented", "leased", "occupied", "vacant", "underMaintenance", "unavailable", "withdrawn"];

export const moduleConfigs: Record<string, ModuleConfig> = {
  leads: {
    collection: "leads",
    createPermission: "leads.create",
    editPermission: "leads.updateAssigned",
    emptyTitle: "No leads have been captured yet.",
    listPermission: "leads.readAssigned",
    prefix: "LEAD",
    route: "/leads",
    title: "Leads",
    fields: [
      { name: "fullName", label: "Full name", required: true, type: "text" },
      { name: "phoneNumber", label: "Phone number", required: true, type: "text" },
      { name: "whatsappNumber", label: "WhatsApp number", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "contactPreference", label: "Contact preference", options: ["phone", "whatsapp", "email", "sms"], type: "select" },
      { name: "preferredLocation", label: "Preferred location", type: "text" },
      { name: "preferredState", label: "Preferred state", type: "text" },
      { name: "preferredCity", label: "Preferred city", type: "text" },
      { name: "propertyType", label: "Property type", type: "text" },
      { name: "preferredPropertyCategory", label: "Preferred property category", type: "text" },
      { name: "preferredBedrooms", label: "Preferred bedrooms", type: "number" },
      { name: "budgetMinimum", label: "Budget minimum", type: "number" },
      { name: "budgetMaximum", label: "Budget maximum", type: "number" },
      { name: "preferredBudgetCurrency", label: "Budget currency", type: "text" },
      { name: "transactionInterest", label: "Transaction interest", options: ["buy", "rent", "lease", "invest"], required: true, type: "select" },
      { name: "source", label: "Source", options: leadSources, required: true, type: "select" },
      { name: "sourcePlatform", label: "Source platform", type: "text" },
      { name: "campaignName", label: "Campaign name", type: "text" },
      { name: "sourceReference", label: "External source reference", type: "text" },
      { name: "assignedTo", label: "Assigned to user ID", type: "text" },
      { name: "score", label: "Lead score", type: "number" },
      { name: "leadTemperature", label: "Lead temperature", options: ["cold", "warm", "hot"], type: "select" },
      { name: "status", label: "Status", options: leadStatuses, required: true, type: "select" },
      { name: "nextFollowUpAt", label: "Next follow-up date", type: "text" },
      { name: "preferredInspectionDate", label: "Preferred inspection date", type: "text" },
      { name: "referralName", label: "Referral name", type: "text" },
      { name: "referralPhone", label: "Referral phone", type: "text" },
      { name: "tags", label: "Tags", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "lostReason", label: "Lost reason", type: "textarea" },
    ],
  },
  clients: {
    collection: "clients",
    createPermission: "clients.create",
    editPermission: "clients.update",
    emptyTitle: "No clients have been created yet.",
    listPermission: "clients.read",
    prefix: "CLIENT",
    route: "/clients",
    title: "Clients",
    fields: [
      { name: "clientType", label: "Client type", options: ["individual", "corporate"], required: true, type: "select" },
      { name: "category", label: "Category", required: true, type: "text" },
      { name: "fullName", label: "Full name", required: true, type: "text" },
      { name: "companyName", label: "Company name", type: "text" },
      { name: "phoneNumber", label: "Phone number", required: true, type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "assignedRelationshipManager", label: "Relationship manager", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "tags", label: "Tags", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  properties: {
    collection: "properties",
    createPermission: "properties.create",
    editPermission: "properties.update",
    emptyTitle: "No properties have been listed yet.",
    listPermission: "properties.read",
    prefix: "PROP",
    route: "/properties",
    title: "Properties",
    fields: [
      { name: "name", label: "Property name", required: true, type: "text" },
      { name: "category", label: "Category", required: true, type: "text" },
      { name: "transactionTypes", label: "Transaction types", required: true, type: "text" },
      { name: "address", label: "Address", required: true, type: "textarea" },
      { name: "state", label: "State", required: true, type: "text" },
      { name: "city", label: "City", required: true, type: "text" },
      { name: "askingPrice", label: "Asking price", type: "number" },
      { name: "rentAmount", label: "Rent amount", type: "number" },
      { name: "propertyStatus", label: "Property status", options: propertyStatuses, required: true, type: "select" },
      { name: "listingStatus", label: "Listing status", type: "text" },
      { name: "marketingStatus", label: "Marketing status", type: "text" },
      { name: "features", label: "Features", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  propertyUnits: {
    collection: "propertyUnits",
    createPermission: "units.create",
    editPermission: "units.update",
    emptyTitle: "No property units have been created yet.",
    listPermission: "units.read",
    prefix: "UNIT",
    route: "/units",
    title: "Property Units",
    fields: [
      { name: "propertyId", label: "Property ID", required: true, type: "text" },
      { name: "unitNumber", label: "Unit number", required: true, type: "text" },
      { name: "plotNumber", label: "Plot number", type: "text" },
      { name: "phase", label: "Phase", type: "text" },
      { name: "block", label: "Block", type: "text" },
      { name: "size", label: "Size", type: "number" },
      { name: "sizeUnit", label: "Size unit", type: "text" },
      { name: "bedrooms", label: "Bedrooms", type: "number" },
      { name: "bathrooms", label: "Bathrooms", type: "number" },
      { name: "askingPrice", label: "Asking price", type: "number" },
      { name: "rentAmount", label: "Rent amount", type: "number" },
      { name: "status", label: "Status", options: propertyStatuses, required: true, type: "select" },
    ],
  },
  tasks: {
    collection: "tasks",
    createPermission: "tasks.create",
    editPermission: "tasks.update",
    emptyTitle: "No tasks have been assigned yet.",
    listPermission: "tasks.read",
    prefix: "TASK",
    route: "/tasks",
    title: "Tasks",
    fields: [
      { name: "title", label: "Title", required: true, type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "priority", label: "Priority", options: ["low", "medium", "high", "urgent"], required: true, type: "select" },
      { name: "status", label: "Status", options: ["notStarted", "inProgress", "waiting", "completed", "cancelled", "overdue"], required: true, type: "select" },
      { name: "dueAt", label: "Due date", type: "text" },
      { name: "assignedTo", label: "Assigned to user ID", type: "text" },
      { name: "relatedEntityType", label: "Related entity type", options: ["lead", "client", "property", "unit"], type: "select" },
      { name: "relatedEntityId", label: "Related entity ID", type: "text" },
    ],
  },
  activities: {
    collection: "activities",
    createPermission: "activities.create",
    editPermission: "activities.create",
    emptyTitle: "No activities have been recorded yet.",
    listPermission: "activities.read",
    prefix: "ACT",
    route: "/activities",
    title: "Activities",
    fields: [
      { name: "type", label: "Type", options: ["phoneCall", "whatsappMessage", "email", "sms", "meeting", "inspection", "followUp", "documentRequest", "paymentReminder", "complaint", "internalNote"], required: true, type: "select" },
      { name: "subject", label: "Subject", required: true, type: "text" },
      { name: "body", label: "Details", type: "textarea" },
      { name: "status", label: "Status", type: "text" },
      { name: "relatedEntityType", label: "Related entity type", options: ["lead", "client", "property", "unit", "task"], type: "select" },
      { name: "relatedEntityId", label: "Related entity ID", type: "text" },
    ],
  },
};

export function columnsFor(moduleKey: ModuleKey): ColumnDef<Record<string, unknown>>[] {
  const statusColumn = {
    header: "Status",
    cell: ({ row }) => {
      const status = String(row.original.status ?? row.original.propertyStatus ?? "active");
      return <Badge tone={statusTone(status)}>{titleCase(status)}</Badge>;
    },
  } satisfies ColumnDef<Record<string, unknown>>;

  if (moduleKey === "leads") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/leads/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Lead", accessorKey: "fullName" },
      { header: "Phone", cell: ({ row }) => formatPhone(String(row.original.phoneNumber ?? "")) },
      { header: "Source", cell: ({ row }) => String(row.original.source ?? "") },
      { header: "Interest", cell: ({ row }) => titleCase(String(row.original.transactionInterest ?? "")) },
      statusColumn,
    ];
  }

  if (moduleKey === "clients") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/clients/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Client", accessorKey: "fullName" },
      { header: "Type", cell: ({ row }) => titleCase(String(row.original.clientType ?? "")) },
      { header: "Phone", cell: ({ row }) => formatPhone(String(row.original.phoneNumber ?? "")) },
      statusColumn,
    ];
  }

  if (moduleKey === "properties") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/properties/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Property", accessorKey: "name" },
      { header: "City", accessorKey: "city" },
      { header: "Price", cell: ({ row }) => formatCurrency(Number(row.original.askingPrice ?? row.original.rentAmount ?? 0)) },
      statusColumn,
    ];
  }

  if (moduleKey === "propertyUnits") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/units/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Unit", accessorKey: "unitNumber" },
      { header: "Property", accessorKey: "propertyId" },
      { header: "Price", cell: ({ row }) => formatCurrency(Number(row.original.askingPrice ?? row.original.rentAmount ?? 0)) },
      statusColumn,
    ];
  }

  if (moduleKey === "tasks") {
    return [
      { header: "Task", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/tasks/${row.original.id}`}>{String(row.original.title ?? "Task")}</Link> },
      { header: "Priority", cell: ({ row }) => titleCase(String(row.original.priority ?? "")) },
      { header: "Assigned", accessorKey: "assignedTo" },
      statusColumn,
    ];
  }

  return [
    { header: "Activity", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/activities/${row.original.id}`}>{String(row.original.subject ?? "Activity")}</Link> },
    { header: "Type", cell: ({ row }) => titleCase(String(row.original.type ?? "")) },
    { header: "Related", accessorKey: "relatedEntityId" },
    statusColumn,
  ];
}

export type ModuleEntity = Activity | Client | Lead | Property | PropertyUnit | Task;
