import { describe, expect, it } from "vitest";
import { buildGuideMemberContext, fallbackGuideAnswer } from "../../src/features/ai-guide/guide-knowledge";

describe("AI Guide knowledge", () => {
  it("includes personal reporting guidance", () => {
    const answer = fallbackGuideAnswer("How do I see my amount generated and performance report?");

    expect(answer).toContain("My performance");
    expect(answer).toContain("verified amount generated");
    expect(answer).toContain("Export CSV");
  });

  it("guides users through enterprise inventory workflows", () => {
    const procurement = fallbackGuideAnswer("How do I create and receive a purchase order?");
    const reservation = fallbackGuideAnswer("How do I reserve stock for a project?");
    const partner = fallbackGuideAnswer("What can a brand partner see in inventory?");

    expect(procurement).toContain("Procure and receive inventory");
    expect(procurement).toContain("creator cannot approve");
    expect(procurement).toContain("Partial receipts");
    expect(reservation).toContain("Reserve stock for work or a sale");
    expect(reservation).toContain("on hand but is removed from the available quantity");
    expect(partner).toContain("Give a brand partner access");
    expect(partner).toContain("assigned brands");
    expect(partner).toContain("Inventory cost and value are not displayed");
    expect(partner).toContain("export CSV or print");
    expect(partner).toContain("cannot access suppliers");
  });

  it("covers current POS documents, quantity entry, and dashboard sales", () => {
    const pos = fallbackGuideAnswer("How do I type sales quantity and print an official invoice?");
    const dashboard = fallbackGuideAnswer("What sales records are shown on the dashboard?");

    expect(pos).toContain("Type the full required whole-number quantity directly");
    expect(pos).toContain("Vlingo letterhead template");
    expect(dashboard).toContain("Sales record section");
    expect(dashboard).toContain("eight latest completed invoices");
  });

  it("explains fixed A4 printing on Android and iPhone", () => {
    const answer = fallbackGuideAnswer("How do I save PDF with mobile print on iPhone?");

    expect(answer).toContain("fixed A4 layout");
    expect(answer).toContain("same document dimensions");
    expect(answer).toContain("Safari on iPhone");
  });

  it("exposes Inventory in AI context only with inventory access", () => {
    const inventoryContext = buildGuideMemberContext({ permissions: ["inventory.read"], role: "brandPartner" });
    const salesContext = buildGuideMemberContext({ permissions: ["leads.readAssigned"], role: "salesExecutive" });

    expect(inventoryContext).toContain("Accessible areas inferred from current permissions: Dashboard, Inventory");
    expect(salesContext).not.toContain("Accessible areas inferred from current permissions: Inventory");
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
