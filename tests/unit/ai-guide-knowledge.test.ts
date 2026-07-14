import { describe, expect, it } from "vitest";
import { buildGuideMemberContext, fallbackGuideAnswer } from "../../src/features/ai-guide/guide-knowledge";

describe("AI Guide knowledge", () => {
  it("includes personal reporting guidance", () => {
    const answer = fallbackGuideAnswer("How do I see my amount generated and performance report?");

    expect(answer).toContain("My performance");
    expect(answer).toContain("verified amount generated");
    expect(answer).toContain("Export CSV");
  });

  it("limits the user context to areas supported by explicit permissions", () => {
    const context = buildGuideMemberContext({
      branchAccess: "assigned",
      branchId: "head-office",
      displayName: "Sales User",
      permissions: ["leads.readAssigned", "deals.read", "tasks.read"],
      role: "salesExecutive",
    });

    expect(context).toContain("Leads and Lead Locations");
    expect(context).toContain("Deals");
    expect(context).toContain("Tasks and Google Calendar");
    expect(context).not.toContain("Finance, User administration");
    expect(context).toContain("assigned branch only");
  });

  it("treats super admins as unrestricted across branches", () => {
    const context = buildGuideMemberContext({
      branchId: "head-office",
      permissions: [],
      roles: ["superAdmin"],
    });

    expect(context).toContain("all branches");
    expect(context).toContain("Unrestricted super admin access");
    expect(context).toContain("Finance");
  });
});
