import { describe, expect, it } from "vitest";
import { accessRuleForPath, navigation, reportsAccessPermissions } from "../../src/components/layout/navigation";
import { defaultAppRoute, hasAnyPermission, hasNotificationOversight, hasOrganizationReportAccess, hasPermission, rolePermissions } from "../../src/lib/permissions";
import type { Member } from "../../src/types/crm";

describe("route access rules", () => {
  it("protects direct module URLs with the matching section permission", () => {
    expect(accessRuleForPath("/deals")?.permissions).toContain("deals.read");
    expect(accessRuleForPath("/deals/new")?.permissions).toContain("deals.create");
    expect(accessRuleForPath("/deals/deal-1/edit")?.permissions).toContain("deals.update");
    expect(accessRuleForPath("/finance/receipts/payment-1")?.permissions).toContain("reports.viewFinancial");
  });

  it("keeps administration routes separated by management permission", () => {
    expect(accessRuleForPath("/settings/users")?.permissions).toEqual(["users.manage"]);
    expect(accessRuleForPath("/settings/roles")?.permissions).toEqual(["roles.manage"]);
    expect(accessRuleForPath("/settings/audit-logs")?.permissions).toEqual(["auditLogs.read"]);
    expect(accessRuleForPath("/settings/calendar")?.permissions).toEqual(["tasks.read", "tasks.create"]);
  });

  it("protects expanded business module routes with matching permissions", () => {
    expect(accessRuleForPath("/ai-guide")?.permissions).toEqual(expect.arrayContaining(["leads.readAssigned", "users.manage"]));
    expect(accessRuleForPath("/offerings")?.permissions).toEqual(["offerings.read"]);
    expect(accessRuleForPath("/offerings/new")?.permissions).toEqual(["offerings.create"]);
    expect(accessRuleForPath("/reports")?.permissions).toEqual(expect.arrayContaining(["leads.readAssigned", "reports.viewFinancial"]));
    expect(accessRuleForPath("/finance")?.permissions).toEqual(["reports.viewFinancial"]);
    expect(accessRuleForPath("/pos")?.permissions).toEqual(["pos.read"]);
    expect(accessRuleForPath("/pos/sales/sale-1/invoice")?.permissions).toEqual(["pos.read"]);
  });

  it("keeps navigation links aligned with direct route access rules", () => {
    const links = navigation.flatMap((section) => section.items);
    for (const link of links) {
      const rule = accessRuleForPath(link.href);
      expect(rule, `${link.href} should have a route access rule`).toBeDefined();
      expect(new Set(rule?.permissions), `${link.href} should use the same permissions in navigation and route guard`).toEqual(new Set(link.permissions));
    }
  });

  it("keeps super admin unrestricted even when explicit permissions are missing", () => {
    const member = {
      branchId: "head-office",
      displayName: "Super",
      email: "super@example.com",
      id: "super-1",
      organizationId: "org-a",
      permissions: [],
      role: "superAdmin",
      status: "active",
      updatedBy: "system",
      createdBy: "system",
    } satisfies Member;

    expect(hasPermission(member, "finance.approve")).toBe(true);
    expect(hasAnyPermission(member, ["offerings.create"])).toBe(true);
  });

  it("limits notification oversight to active managerial roles", () => {
    const member = {
      branchId: "head-office",
      displayName: "Sales User",
      email: "sales@example.com",
      id: "sales-1",
      organizationId: "org-a",
      permissions: rolePermissions.salesExecutive,
      role: "salesExecutive" as const,
      status: "active" as const,
    };

    expect(hasNotificationOversight(member)).toBe(false);
    expect(hasNotificationOversight({ ...member, role: "salesManager" })).toBe(true);
    expect(hasNotificationOversight({ ...member, roles: ["salesExecutive", "operationsManager"] })).toBe(true);
    expect(hasNotificationOversight({ ...member, role: "financeManager", status: "disabled" })).toBe(false);
  });

  it("does not grant finance navigation to sales-only roles", () => {
    const salesPermissions = rolePermissions.salesExecutive;
    const financeRule = accessRuleForPath("/finance");
    expect(financeRule).toBeDefined();
    expect(financeRule?.permissions.some((permission) => salesPermissions.includes(permission))).toBe(false);
  });

  it("limits organization overview to appropriate reporting and management roles", () => {
    const memberFor = (role: keyof typeof rolePermissions) => ({
      branchId: "head-office",
      displayName: role,
      email: `${role}@example.com`,
      id: `${role}-1`,
      organizationId: "org-a",
      permissions: rolePermissions[role],
      role,
      status: "active" as const,
    } as Member);

    expect(hasOrganizationReportAccess(memberFor("superAdmin"))).toBe(true);
    expect(hasOrganizationReportAccess(memberFor("managingDirector"))).toBe(true);
    expect(hasOrganizationReportAccess(memberFor("operationsManager"))).toBe(true);
    expect(hasOrganizationReportAccess(memberFor("salesManager"))).toBe(true);
    expect(hasOrganizationReportAccess(memberFor("financeManager"))).toBe(true);
    expect(hasOrganizationReportAccess(memberFor("salesExecutive"))).toBe(false);
    expect(hasOrganizationReportAccess(memberFor("frontDeskOfficer"))).toBe(false);
  });

  it("allows every built-in role to open its own performance report", () => {
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      const member = {
        branchId: "head-office",
        displayName: role,
        email: `${role}@example.com`,
        id: `${role}-1`,
        organizationId: "org-a",
        permissions,
        role,
        status: "active",
      } as Member;
      expect(hasAnyPermission(member, reportsAccessPermissions), `${role} report access`).toBe(role !== "brandPartner");
    }
  });

  it("routes brand partners to an inventory-first dashboard", () => {
    expect(accessRuleForPath("/inventory")?.permissions).toEqual(["inventory.read"]);
    expect(rolePermissions.brandPartner).toEqual(["inventory.read", "inventory.viewReports", "inventory.comment"]);
    expect(rolePermissions.brandPartner).not.toEqual(expect.arrayContaining(["offerings.read", "reports.viewFinancial"]));
    const brandPartner = {
      branchId: "head-office",
      displayName: "Brand Partner",
      email: "partner@example.com",
      id: "partner-1",
      organizationId: "org-a",
      permissions: rolePermissions.brandPartner,
      role: "brandPartner" as const,
      status: "active" as const,
    } as Member;
    expect(defaultAppRoute(brandPartner)).toBe("/dashboard");
    expect(accessRuleForPath("/dashboard")?.permissions).toContain("inventory.read");
    expect(accessRuleForPath("/pos")?.permissions.some((permission) => rolePermissions.brandPartner.includes(permission))).toBe(false);
  });

  it("separates enterprise inventory duties", () => {
    expect(rolePermissions.inventoryManager).toEqual(expect.arrayContaining(["inventory.procure", "inventory.count", "inventory.reserve"]));
    expect(rolePermissions.inventoryManager).not.toContain("inventory.approve");
    expect(rolePermissions.operationsManager).toEqual(expect.arrayContaining(["inventory.procure", "inventory.count", "inventory.reserve", "inventory.approve"]));
    expect(rolePermissions.financeManager).toContain("inventory.approve");
    expect(rolePermissions.brandPartner).not.toEqual(expect.arrayContaining(["inventory.procure", "inventory.count", "inventory.reserve", "inventory.approve"]));
  });

  it("keeps role permissions aligned with operational responsibilities", () => {
    expect(rolePermissions.salesExecutive).toEqual(expect.arrayContaining(["deals.update", "offerings.read", "pos.read", "pos.sell"]));
    expect(rolePermissions.salesManager).toEqual(expect.arrayContaining(["pos.read", "pos.sell"]));
    expect(rolePermissions.salesExecutive).not.toEqual(expect.arrayContaining(["clients.update", "finance.create", "users.manage"]));
    expect(rolePermissions.salesManager).toEqual(expect.arrayContaining(["clients.update", "leads.assign"]));
    expect(rolePermissions.auditor).toEqual(expect.arrayContaining(["reports.viewFinancial", "auditLogs.read"]));
    expect(rolePermissions.auditor).not.toEqual(expect.arrayContaining(["finance.create", "finance.update", "finance.approve"]));
  });
});
