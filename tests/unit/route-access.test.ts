import { describe, expect, it } from "vitest";
import { accessRuleForPath } from "../../src/components/layout/navigation";

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
});
