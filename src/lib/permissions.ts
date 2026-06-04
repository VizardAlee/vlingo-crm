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
    "properties.create",
    "properties.read",
    "properties.update",
    "properties.approve",
    "units.create",
    "units.read",
    "units.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
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
    "units.read",
    "tasks.read",
    "activities.read",
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
    "properties.create",
    "properties.read",
    "properties.update",
    "units.create",
    "units.read",
    "units.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
  ],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "properties.read", "units.read", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "properties.read", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "properties.read", "auditLogs.read"],
  projectManager: ["properties.read", "properties.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "properties.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "properties.read", "units.read", "tasks.read", "activities.read", "auditLogs.read"],
};

export function hasPermission(member: Member | null, permission: Permission) {
  if (!member || member.status !== "active") {
    return false;
  }

  return member.permissions.includes(permission) || rolePermissions[member.role].includes(permission);
}

export function hasAnyPermission(member: Member | null, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(member, permission));
}
