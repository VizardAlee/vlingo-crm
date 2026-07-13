import { describe, expect, it } from "vitest";
import { accessRuleForPath, navigation } from "../../src/components/layout/navigation";
import { hasAnyPermission, hasNotificationOversight, hasPermission, rolePermissions } from "../../src/lib/permissions";
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
  });

  it("protects expanded business module routes with matching permissions", () => {
    expect(accessRuleForPath("/ai-guide")?.permissions).toEqual(expect.arrayContaining(["leads.readAssigned", "users.manage"]));
    expect(accessRuleForPath("/offerings")?.permissions).toEqual(["offerings.read"]);
    expect(accessRuleForPath("/offerings/new")?.permissions).toEqual(["offerings.create"]);
    expect(accessRuleForPath("/reports")?.permissions).toEqual(["reports.viewFinancial", "dashboard.viewExecutive"]);
    expect(accessRuleForPath("/finance")?.permissions).toEqual(["reports.viewFinancial"]);
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

  it("keeps role permissions aligned with operational responsibilities", () => {
    expect(rolePermissions.salesExecutive).toEqual(expect.arrayContaining(["deals.update", "offerings.read"]));
    expect(rolePermissions.salesExecutive).not.toEqual(expect.arrayContaining(["clients.update", "finance.create", "users.manage"]));
    expect(rolePermissions.salesManager).toEqual(expect.arrayContaining(["clients.update", "leads.assign"]));
    expect(rolePermissions.auditor).toEqual(expect.arrayContaining(["reports.viewFinancial", "auditLogs.read"]));
    expect(rolePermissions.auditor).not.toEqual(expect.arrayContaining(["finance.create", "finance.update", "finance.approve"]));
  });
});
