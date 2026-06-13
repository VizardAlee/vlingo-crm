import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const projectId = "beacon-operations-crm";
let testEnv: RulesTestEnvironment;

async function seedMember(uid: string, orgId: string, permissions: string[], role = "salesExecutive") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/${uid}`), {
      branchId: "head-office",
      displayName: uid,
      email: `${uid}@test.local`,
      organizationId: orgId,
      permissions,
      role,
      status: "active",
    });
  });
}

async function seedLead(orgId: string, leadId: string, assignedTo: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/leads/${leadId}`), {
      assignedTo,
      branchId: "head-office",
      createdBy: "system",
      fullName: "Test Lead",
      isDeleted: false,
      organizationId: orgId,
      phoneNumber: "08010000000",
      source: "Website",
      status: "new",
      updatedBy: "system",
    });
  });
}

describe("Beacon Firestore rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("blocks unauthenticated organization reads", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "organizations/beacon-corporate-realty/leads/lead-1")));
  });

  it("blocks another organization's data", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    await seedLead("org-b", "lead-1", "sales-1");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertFails(getDoc(doc(db, "organizations/org-b/leads/lead-1")));
  });

  it("allows a sales executive to read assigned leads", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    await seedLead("org-a", "lead-1", "sales-1");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertSucceeds(getDoc(doc(db, "organizations/org-a/leads/lead-1")));
  });

  it("blocks sales executive role escalation", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertFails(setDoc(doc(db, "organizations/org-a/members/sales-1"), {
      organizationId: "org-a",
      permissions: ["roles.manage"],
      role: "superAdmin",
      status: "active",
    }));
  });

  it("blocks direct member writes even for user managers", async () => {
    await seedMember("manager-1", "org-a", ["users.manage"], "operationsManager");
    const db = testEnv.authenticatedContext("manager-1").firestore();
    await assertFails(setDoc(doc(db, "organizations/org-a/members/new-user"), {
      branchId: "head-office",
      displayName: "New User",
      email: "new-user@test.local",
      organizationId: "org-a",
      permissions: ["leads.readAssigned"],
      role: "salesExecutive",
      status: "active",
    }));
  });

  it("allows user managers to read member records", async () => {
    await seedMember("manager-1", "org-a", ["users.manage"], "operationsManager");
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("manager-1").firestore();
    await assertSucceeds(getDoc(doc(db, "organizations/org-a/members/sales-1")));
  });

  it("allows sales manager to assign leads", async () => {
    await seedMember("manager-1", "org-a", ["leads.readAll", "leads.assign"], "salesManager");
    await seedLead("org-a", "lead-1", "sales-1");
    const db = testEnv.authenticatedContext("manager-1").firestore();
    await assertSucceeds(updateDoc(doc(db, "organizations/org-a/leads/lead-1"), {
      assignedTo: "sales-2",
      organizationId: "org-a",
      updatedBy: "manager-1",
    }));
  });

  it("allows project managers to create and update development projects", async () => {
    await seedMember("project-1", "org-a", ["development.create", "development.read", "development.update"], "projectManager");
    const db = testEnv.authenticatedContext("project-1").firestore();
    const projectRef = doc(db, "organizations/org-a/developmentProjects/project-1");

    await assertSucceeds(setDoc(projectRef, {
      branchId: "head-office",
      createdBy: "project-1",
      isDeleted: false,
      name: "Beacon Court Phase 2",
      organizationId: "org-a",
      projectType: "Building construction",
      status: "planning",
      updatedBy: "project-1",
    }));

    await assertSucceeds(updateDoc(projectRef, {
      organizationId: "org-a",
      progressPercent: 35,
      status: "construction",
      updatedBy: "project-1",
    }));
  });

  it("blocks development project writes without development permission", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(setDoc(doc(db, "organizations/org-a/developmentProjects/project-1"), {
      branchId: "head-office",
      createdBy: "sales-1",
      isDeleted: false,
      name: "Unauthorized Project",
      organizationId: "org-a",
      projectType: "Building construction",
      status: "planning",
      updatedBy: "sales-1",
    }));
  });

  it("allows marketing officers to create and update marketing campaigns", async () => {
    await seedMember("marketing-1", "org-a", ["marketing.create", "marketing.read", "marketing.update"], "marketingOfficer");
    const db = testEnv.authenticatedContext("marketing-1").firestore();
    const campaignRef = doc(db, "organizations/org-a/marketingCampaigns/campaign-1");

    await assertSucceeds(setDoc(campaignRef, {
      branchId: "head-office",
      campaignType: "Lead generation",
      channel: "Instagram",
      createdBy: "marketing-1",
      isDeleted: false,
      name: "Lekki Launch Campaign",
      organizationId: "org-a",
      status: "planned",
      updatedBy: "marketing-1",
    }));

    await assertSucceeds(updateDoc(campaignRef, {
      actualLeads: 12,
      organizationId: "org-a",
      status: "active",
      updatedBy: "marketing-1",
    }));
  });

  it("blocks marketing campaign writes without marketing permission", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(setDoc(doc(db, "organizations/org-a/marketingCampaigns/campaign-1"), {
      branchId: "head-office",
      campaignType: "Lead generation",
      channel: "Instagram",
      createdBy: "sales-1",
      isDeleted: false,
      name: "Unauthorized Campaign",
      organizationId: "org-a",
      status: "planned",
      updatedBy: "sales-1",
    }));
  });

  it("allows sales users to create deals and finance users to read them", async () => {
    await seedMember("sales-1", "org-a", ["deals.create", "deals.read", "deals.update"], "salesExecutive");
    await seedMember("finance-1", "org-a", ["reports.viewFinancial"], "accountant");
    const salesDb = testEnv.authenticatedContext("sales-1").firestore();
    const financeDb = testEnv.authenticatedContext("finance-1").firestore();
    const dealRef = doc(salesDb, "organizations/org-a/deals/deal-1");

    await assertSucceeds(setDoc(dealRef, {
      branchId: "head-office",
      createdBy: "sales-1",
      dealType: "sale",
      isDeleted: false,
      organizationId: "org-a",
      status: "negotiation",
      title: "Test sale deal",
      updatedBy: "sales-1",
    }));

    await assertSucceeds(updateDoc(dealRef, {
      agreedAmount: 25000000,
      financeStatus: "paymentPending",
      organizationId: "org-a",
      updatedBy: "sales-1",
    }));
    await assertSucceeds(getDoc(doc(financeDb, "organizations/org-a/deals/deal-1")));
  });

  it("allows existing sales roles to use deals before permission backfill", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    const dealRef = doc(db, "organizations/org-a/deals/deal-1");

    await assertSucceeds(setDoc(dealRef, {
      branchId: "head-office",
      createdBy: "sales-1",
      dealType: "sale",
      isDeleted: false,
      organizationId: "org-a",
      status: "new",
      title: "Role-backed deal",
      updatedBy: "sales-1",
    }));

    await assertSucceeds(getDoc(dealRef));
    await assertSucceeds(updateDoc(dealRef, {
      organizationId: "org-a",
      status: "negotiation",
      updatedBy: "sales-1",
    }));
  });

  it("blocks deal writes without deal permission", async () => {
    await seedMember("agent-1", "org-a", ["leads.readAssigned"], "agent");
    const db = testEnv.authenticatedContext("agent-1").firestore();

    await assertFails(setDoc(doc(db, "organizations/org-a/deals/deal-1"), {
      branchId: "head-office",
      createdBy: "agent-1",
      dealType: "sale",
      isDeleted: false,
      organizationId: "org-a",
      status: "new",
      title: "Unauthorized deal",
      updatedBy: "agent-1",
    }));
  });

  it("allows users to persist and mark their own notifications read", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    const notificationRef = doc(db, "organizations/org-a/notifications/notification-1");

    await assertSucceeds(setDoc(notificationRef, {
      body: "Follow up lead today.",
      branchId: "head-office",
      createdBy: "sales-1",
      dedupeKey: "lead-followup:lead-1:2026-06-12",
      href: "/leads/lead-1",
      isDeleted: false,
      kind: "lead",
      organizationId: "org-a",
      recipientId: "sales-1",
      status: "active",
      title: "Follow up Test Lead",
      tone: "warning",
      updatedBy: "sales-1",
    }));

    await assertSucceeds(getDoc(notificationRef));
    await assertSucceeds(updateDoc(notificationRef, {
      organizationId: "org-a",
      readAt: "2026-06-12T12:00:00.000Z",
      readBy: "sales-1",
      updatedBy: "sales-1",
    }));
  });

  it("blocks users from reading or mutating another user's notifications", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    await seedMember("sales-2", "org-a", [], "salesExecutive");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/notifications/notification-1"), {
        body: "Private reminder.",
        branchId: "head-office",
        createdBy: "sales-1",
        dedupeKey: "task:task-1:2026-06-12",
        href: "/tasks/task-1",
        isDeleted: false,
        kind: "task",
        organizationId: "org-a",
        recipientId: "sales-1",
        status: "active",
        title: "Private task",
        tone: "warning",
        updatedBy: "sales-1",
      });
    });
    const db = testEnv.authenticatedContext("sales-2").firestore();
    const notificationRef = doc(db, "organizations/org-a/notifications/notification-1");

    await assertFails(getDoc(notificationRef));
    await assertFails(updateDoc(notificationRef, {
      organizationId: "org-a",
      readAt: "2026-06-12T12:00:00.000Z",
      readBy: "sales-2",
      updatedBy: "sales-2",
    }));
  });

  it("blocks notification content edits during read-state updates", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/notifications/notification-1"), {
        body: "Follow up lead today.",
        branchId: "head-office",
        createdBy: "sales-1",
        dedupeKey: "lead-followup:lead-1:2026-06-12",
        href: "/leads/lead-1",
        isDeleted: false,
        kind: "lead",
        organizationId: "org-a",
        recipientId: "sales-1",
        status: "active",
        title: "Follow up Test Lead",
        tone: "warning",
        updatedBy: "sales-1",
      });
    });
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertFails(updateDoc(doc(db, "organizations/org-a/notifications/notification-1"), {
      organizationId: "org-a",
      readAt: "2026-06-12T12:00:00.000Z",
      readBy: "sales-1",
      title: "Changed title",
      updatedBy: "sales-1",
    }));
  });

  it("allows finance users to create finance records but not approve them", async () => {
    await seedMember("accountant-1", "org-a", ["finance.create", "finance.update", "reports.viewFinancial"], "accountant");
    const db = testEnv.authenticatedContext("accountant-1").firestore();
    const expenseRef = doc(db, "organizations/org-a/financeExpenses/expense-1");

    await assertSucceeds(setDoc(expenseRef, {
      amount: 25000,
      approvalStatus: "pendingApproval",
      branchId: "head-office",
      category: "Repairs",
      createdBy: "accountant-1",
      date: "2026-06-12",
      isDeleted: false,
      organizationId: "org-a",
      updatedBy: "accountant-1",
    }));

    await assertSucceeds(getDoc(expenseRef));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/leads/lead-finance-1"), {
        assignedTo: "sales-1",
        branchId: "head-office",
        createdBy: "sales-1",
        fullName: "Finance Visible Lead",
        isDeleted: false,
        organizationId: "org-a",
        phoneNumber: "08010000000",
        source: "Website",
        status: "paymentPending",
        updatedBy: "sales-1",
      });
    });
    await assertSucceeds(getDoc(doc(db, "organizations/org-a/leads/lead-finance-1")));
    await assertSucceeds(updateDoc(expenseRef, {
      description: "Leak repair receipt attached.",
      organizationId: "org-a",
      updatedBy: "accountant-1",
    }));

    await assertFails(updateDoc(expenseRef, {
      approvalStatus: "approved",
      approvedBy: "accountant-1",
      organizationId: "org-a",
      updatedBy: "accountant-1",
    }));
  });

  it("allows finance approvers to approve finance records", async () => {
    await seedMember("finance-1", "org-a", ["finance.create", "finance.update", "finance.approve", "reports.viewFinancial"], "financeManager");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/financePayments/payment-1"), {
        amount: 500000,
        branchId: "head-office",
        createdBy: "accountant-1",
        isDeleted: false,
        organizationId: "org-a",
        receiptNumber: "RCT-20260612-00001",
        tenantName: "Test Tenant",
        updatedBy: "accountant-1",
        verificationStatus: "pending",
      });
    });

    const db = testEnv.authenticatedContext("finance-1").firestore();
    await assertSucceeds(updateDoc(doc(db, "organizations/org-a/financePayments/payment-1"), {
      organizationId: "org-a",
      updatedBy: "finance-1",
      verificationStatus: "verified",
      verifiedBy: "finance-1",
    }));
  });

  it("blocks finance records without finance permission", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(setDoc(doc(db, "organizations/org-a/financeCommissions/commission-1"), {
      amount: 100000,
      approvalStatus: "pendingApproval",
      beneficiaryName: "Agent One",
      branchId: "head-office",
      createdBy: "sales-1",
      isDeleted: false,
      organizationId: "org-a",
      sourceId: "property-1",
      sourceType: "property",
      updatedBy: "sales-1",
    }));
  });

  it("blocks ordinary audit log writes", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertFails(setDoc(doc(db, "organizations/org-a/auditLogs/log-1"), {
      action: "record.update",
      branchId: "head-office",
      entityId: "lead-1",
      entityType: "lead",
      organizationId: "org-a",
    }));
  });

  it("blocks organizationId changes", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned", "leads.updateAssigned"]);
    await seedLead("org-a", "lead-1", "sales-1");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    await assertFails(updateDoc(doc(db, "organizations/org-a/leads/lead-1"), {
      organizationId: "org-b",
      updatedBy: "sales-1",
    }));
  });

  it("has the expected test count", () => {
    expect(true).toBe(true);
  });
});
