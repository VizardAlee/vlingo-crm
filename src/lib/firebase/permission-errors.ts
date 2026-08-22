import type { OrgCollection } from "@/services/firestore-paths";

type FirestoreAction = "create" | "delete" | "list" | "read" | "update";

const collectionPermissions: Partial<Record<OrgCollection, Partial<Record<FirestoreAction, string>>>> = {
  activities: { create: "activities.create", list: "activities.read", read: "activities.read", update: "activities.create" },
  clients: { create: "clients.create", list: "clients.read", read: "clients.read", update: "clients.update" },
  deals: { create: "deals.create", list: "deals.read", read: "deals.read", update: "deals.update" },
  developmentProjects: { create: "development.create", list: "development.read", read: "development.read", update: "development.update" },
  documents: { create: "module read permission for the linked record", list: "module read permission for the linked record", read: "module read permission for the linked record", update: "users.manage" },
  financeCommissions: { create: "finance.create", list: "reports.viewFinancial", read: "reports.viewFinancial", update: "finance.update or finance.approve" },
  financeExpenses: { create: "finance.create", list: "reports.viewFinancial", read: "reports.viewFinancial", update: "finance.update or finance.approve" },
  financePayments: { create: "finance.create", list: "reports.viewFinancial", read: "reports.viewFinancial", update: "finance.update or finance.approve" },
  installationProjects: { create: "installations.create", list: "installations.read", read: "installations.read", update: "installations.update" },
  installationInvoices: { create: "finance.create", list: "installations.read or reports.viewFinancial", read: "installations.read or reports.viewFinancial", update: "finance.update or finance.approve" },
  leads: { create: "leads.create", list: "leads.readAssigned or leads.readAll", read: "leads.readAssigned or leads.readAll", update: "leads.updateAssigned or leads.assign" },
  marketingCampaigns: { create: "marketing.create", list: "marketing.read", read: "marketing.read", update: "marketing.update" },
  members: { list: "users.manage, roles.manage, tasks.create, tasks.update, or activities.read", read: "self or users.manage/roles.manage" },
  notifications: { create: "related workflow permission", list: "notification recipient access", read: "notification recipient access", update: "notification recipient access" },
  offerings: { create: "offerings.create", list: "offerings.read", read: "offerings.read", update: "offerings.update" },
  propertyStakeholders: { create: "properties.create", list: "properties.read", read: "properties.read", update: "properties.update" },
  propertyUnits: { create: "units.create", list: "units.read", read: "units.read", update: "units.update" },
  properties: { create: "properties.create", list: "properties.read", read: "properties.read", update: "properties.update" },
  rentalTenancies: { create: "rentals.create", list: "rentals.read", read: "rentals.read", update: "rentals.update" },
  tasks: { create: "tasks.create", list: "tasks.read", read: "tasks.read", update: "tasks.update" },
};

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isFirestorePermissionDenied(error: unknown) {
  return errorCode(error) === "permission-denied" || errorMessage(error).toLowerCase().includes("missing or insufficient permissions");
}

export function describeFirestorePermissionError(input: {
  action: FirestoreAction;
  collectionName?: OrgCollection;
  organizationId: string;
  path?: string;
  requiredPermission?: string;
}) {
  const path = input.path ?? `organizations/${input.organizationId}/${input.collectionName ?? ""}`;
  const requiredPermission = input.requiredPermission ?? (input.collectionName ? collectionPermissions[input.collectionName]?.[input.action] : undefined);
  return [
    `Permission denied while trying to ${input.action} ${path}.`,
    requiredPermission ? `Likely required backend permission: ${requiredPermission}.` : null,
    "Check the signed-in user's member document permissions array, branchId/branchAccess, and record branchId.",
  ].filter(Boolean).join(" ");
}

export function enrichFirestoreError(error: unknown, input: Parameters<typeof describeFirestorePermissionError>[0]) {
  if (!isFirestorePermissionDenied(error)) {
    return error;
  }

  return new Error(describeFirestorePermissionError(input), { cause: error });
}
