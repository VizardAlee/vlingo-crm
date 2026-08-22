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
    "installations.create",
    "installations.read",
    "installations.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "inventory.read",
    "inventory.manageCatalog",
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.procure",
    "inventory.approve",
    "inventory.count",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
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
    "deals.read",
    "installations.read",
    "marketing.read",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.approve",
    "pos.read",
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
    "installations.create",
    "installations.read",
    "installations.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "inventory.read",
    "inventory.manageCatalog",
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.procure",
    "inventory.approve",
    "inventory.count",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
    "users.manage",
  ],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "clients.update", "deals.create", "deals.read", "deals.update", "installations.create", "installations.read", "marketing.read", "offerings.read", "inventory.read", "inventory.viewReports", "inventory.reserve", "pos.read", "pos.sell", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "deals.create", "deals.read", "deals.update", "installations.create", "installations.read", "offerings.read", "inventory.read", "inventory.reserve", "pos.read", "pos.sell", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["offerings.read", "deals.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "deals.read", "installations.read", "offerings.read", "inventory.read", "inventory.viewReports", "inventory.comment", "inventory.approve", "pos.read", "activities.create", "activities.read", "finance.create", "finance.update", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "deals.read", "installations.read", "offerings.read", "inventory.read", "inventory.viewReports", "pos.read", "activities.create", "activities.read", "finance.create", "finance.update", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "deals.read", "offerings.read", "auditLogs.read"],
  projectManager: ["installations.create", "installations.read", "installations.update", "offerings.read", "inventory.read", "inventory.issue", "inventory.reserve", "inventory.procure", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "marketing.create", "marketing.read", "marketing.update", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "offerings.read", "inventory.read", "pos.read", "pos.sell", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "deals.read", "installations.read", "marketing.read", "offerings.read", "inventory.read", "inventory.viewReports", "pos.read", "tasks.read", "activities.read", "reports.viewFinancial", "auditLogs.read"],
  inventoryManager: ["installations.read", "offerings.create", "offerings.read", "offerings.update", "inventory.read", "inventory.manageCatalog", "inventory.receive", "inventory.issue", "inventory.adjust", "inventory.transfer", "inventory.viewReports", "inventory.comment", "inventory.procure", "inventory.count", "inventory.reserve", "pos.read", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  brandPartner: ["inventory.read", "inventory.viewReports", "inventory.comment"],
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

export function defaultAppRoute(member: Member | null) {
  if (hasAnyPermission(member, ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll", "inventory.read"])) {
    return "/dashboard";
  }

  if (hasPermission(member, "inventory.read")) {
    return "/inventory";
  }

  if (hasPermission(member, "clients.read")) {
    return "/clients";
  }

  if (hasPermission(member, "tasks.read")) {
    return "/tasks";
  }

  return "/dashboard";
}

export function hasOrganizationReportAccess(member: Member | null) {
  return hasAnyPermission(member, ["reports.viewFinancial", "dashboard.viewExecutive"]) || (
    hasPermission(member, "leads.readAll") && hasPermission(member, "leads.assign")
  );
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
  "financeManager",
  "projectManager",
];

export function hasNotificationOversight(member: Member | null) {
  if (!member || member.status !== "active") {
    return false;
  }

  return memberRoles(member).some((role) => notificationOversightRoles.includes(role));
}
