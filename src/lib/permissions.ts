import type { Member, Permission, RoleName } from "@/types/crm";

export const rolePermissions: Record<RoleName, Permission[]> = {
  superAdmin: [
    "dashboard.viewExecutive",
    "leads.create",
    "leads.readAssigned",
    "leads.readAll",
    "leads.updateAssigned",
    "leads.assign",
    "clients.create",
    "clients.read",
    "clients.update",
    "deals.create",
    "deals.read",
    "deals.update",
    "properties.create",
    "properties.read",
    "properties.update",
    "properties.approve",
    "units.create",
    "units.read",
    "units.update",
    "rentals.create",
    "rentals.read",
    "rentals.update",
    "development.create",
    "development.read",
    "development.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
    "finance.create",
    "finance.update",
    "finance.approve",
    "reports.viewFinancial",
    "users.manage",
    "roles.manage",
    "auditLogs.read",
  ],
  managingDirector: [
    "dashboard.viewExecutive",
    "leads.readAll",
    "clients.read",
    "properties.read",
    "deals.read",
    "units.read",
    "rentals.read",
    "development.read",
    "marketing.read",
    "offerings.read",
    "tasks.read",
    "activities.read",
    "finance.approve",
    "reports.viewFinancial",
    "auditLogs.read",
  ],
  operationsManager: [
    "dashboard.viewExecutive",
    "leads.create",
    "leads.readAll",
    "leads.assign",
    "clients.create",
    "clients.read",
    "clients.update",
    "deals.create",
    "deals.read",
    "deals.update",
    "properties.create",
    "properties.read",
    "properties.update",
    "units.create",
    "units.read",
    "units.update",
    "rentals.create",
    "rentals.read",
    "rentals.update",
    "development.create",
    "development.read",
    "development.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
    "users.manage",
  ],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "clients.update", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "marketing.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "offerings.read", "deals.read", "rentals.create", "rentals.read", "rentals.update", "development.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "properties.read", "units.read", "deals.read", "rentals.read", "rentals.update", "offerings.read", "activities.create", "activities.read", "finance.create", "finance.update", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "properties.read", "deals.read", "rentals.read", "rentals.update", "offerings.read", "activities.create", "activities.read", "finance.create", "finance.update", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "properties.read", "deals.read", "rentals.read", "offerings.read", "auditLogs.read"],
  projectManager: ["properties.read", "properties.update", "development.create", "development.read", "development.update", "offerings.read", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "properties.read", "marketing.create", "marketing.read", "marketing.update", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "deals.read", "properties.read", "units.read", "rentals.read", "development.read", "marketing.read", "offerings.read", "tasks.read", "activities.read", "reports.viewFinancial", "auditLogs.read"],
};

export function hasPermission(member: Member | null, permission: Permission) {
  if (!member || member.status !== "active") {
    return false;
  }

  if (memberRoles(member).includes("superAdmin")) {
    return true;
  }

  return (member.permissions ?? []).includes(permission);
}

export function hasAnyPermission(member: Member | null, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(member, permission));
}

export function memberRoles(member: Member | null) {
  if (!member) {
    return [] as RoleName[];
  }

  return Array.from(new Set([...(member.roles ?? []), member.role].filter(Boolean)));
}

export function permissionsForRoles(roles: RoleName[]) {
  return Array.from(new Set(roles.flatMap((role) => rolePermissions[role])));
}

export function canAccessAllBranches(member: Member | null) {
  if (!member || member.status !== "active") {
    return false;
  }

  return member.branchAccess === "all" || memberRoles(member).includes("superAdmin");
}

export function canAccessBranch(member: Member | null, branchId: string) {
  if (!member || member.status !== "active") {
    return false;
  }

  return canAccessAllBranches(member) || member.branchId === branchId;
}

export function effectiveBranchId(member: Member | null, activeBranchId?: string) {
  if (!member || member.status !== "active") {
    return activeBranchId ?? "";
  }

  if (canAccessAllBranches(member)) {
    return activeBranchId || member.branchId || "";
  }

  return member.branchId || activeBranchId || "";
}

export function isAssignedOnlySalesUser(member: Member | null) {
  const roles = memberRoles(member);
  if (!roles.includes("salesExecutive")) {
    return false;
  }

  return !roles.some((role) => ["superAdmin", "managingDirector", "operationsManager", "salesManager"].includes(role));
}

const notificationOversightRoles: RoleName[] = [
  "superAdmin",
  "managingDirector",
  "operationsManager",
  "salesManager",
  "propertyManager",
  "financeManager",
  "projectManager",
];

export function hasNotificationOversight(member: Member | null) {
  if (!member || member.status !== "active") {
    return false;
  }

  return memberRoles(member).some((role) => notificationOversightRoles.includes(role));
}
