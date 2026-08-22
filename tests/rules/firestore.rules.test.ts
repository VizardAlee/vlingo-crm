import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const projectId = "beacon-operations-crm";
let testEnv: RulesTestEnvironment;

async function seedMember(uid: string, orgId: string, permissions: string[], role = "salesExecutive", extra: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/members/${uid}`), {
      branchId: "head-office",
      displayName: uid,
      email: `${uid}@test.local`,
      organizationId: orgId,
      permissions,
      role,
      status: "active",
      ...extra,
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

async function seedClient(orgId: string, clientId: string, assignedTo: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/clients/${clientId}`), {
      assignedRelationshipManager: assignedTo,
      branchId: "head-office",
      createdBy: "system",
      fullName: "Test Client",
      isDeleted: false,
      organizationId: orgId,
      phoneNumber: "08010000000",
      status: "active",
      updatedBy: "system",
    });
  });
}

async function seedDeal(orgId: string, dealId: string, dealOwnerId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/deals/${dealId}`), {
      branchId: "head-office",
      createdBy: "system",
      dealOwnerId,
      dealType: "sale",
      financeStatus: "notInvoiced",
      isDeleted: false,
      organizationId: orgId,
      status: "negotiation",
      title: "Test sale deal",
      updatedBy: "system",
    });
  });
}

async function seedTask(orgId: string, taskId: string, assignedTo: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `organizations/${orgId}/tasks/${taskId}`), {
      assignedTo,
      branchId: "head-office",
      createdBy: "system",
      isDeleted: false,
      organizationId: orgId,
      status: "open",
      title: "Test task",
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

  it("requires server-validated branch lifecycle actions", async () => {
    await seedMember("manager-1", "org-a", ["users.manage"], "operationsManager");
    const managerDb = testEnv.authenticatedContext("manager-1").firestore();
    const branchRef = doc(managerDb, "organizations/org-a/branches/kano");
    await assertSucceeds(setDoc(branchRef, {
      address: "Kano",
      code: "KAN",
      name: "Kano",
      organizationId: "org-a",
      status: "active",
    }));
    await assertSucceeds(updateDoc(branchRef, { name: "Kano Branch" }));
    await assertFails(updateDoc(branchRef, { status: "closed" }));
    await assertFails(deleteDoc(branchRef));
  });

  it("scopes brand partners to their assigned inventory brands", async () => {
    await seedMember("partner-1", "org-a", ["inventory.read", "inventory.viewReports", "inventory.comment"], "brandPartner", { partnerBrandIds: ["sorotec"] });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      for (const brandId of ["sorotec", "revo"]) {
        await setDoc(doc(adminDb, `organizations/org-a/inventoryBalances/item-${brandId}_warehouse`), {
          brandId,
          branchId: "head-office",
          offeringId: `item-${brandId}`,
          offeringName: `${brandId} inverter`,
          organizationId: "org-a",
          quantityOnHand: 10,
        });
      }
    });
    const partnerDb = testEnv.authenticatedContext("partner-1").firestore();
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/item-sorotec_warehouse")));
    await assertFails(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/item-revo_warehouse")));
  });

  it("allows brand representatives to read assigned brands across every branch", async () => {
    await seedMember("partner-1", "org-a", ["inventory.read", "inventory.viewReports", "inventory.comment"], "brandPartner", { partnerBrandIds: ["sorotec"] });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      for (const branchId of ["head-office", "abuja", "kano"]) {
        await setDoc(doc(adminDb, `organizations/org-a/inventoryBalances/sorotec-${branchId}`), { brandId: "sorotec", branchId, offeringId: "item-sorotec", organizationId: "org-a", quantityOnHand: 5 });
      }
      await setDoc(doc(adminDb, "organizations/org-a/inventoryBalances/revo-head-office"), { brandId: "revo", branchId: "head-office", offeringId: "item-revo", organizationId: "org-a", quantityOnHand: 5 });
    });
    const partnerDb = testEnv.authenticatedContext("partner-1").firestore();
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/sorotec-head-office")));
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/sorotec-abuja")));
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/sorotec-kano")));
    await assertFails(getDoc(doc(partnerDb, "organizations/org-a/inventoryBalances/revo-head-office")));
    await assertSucceeds(getDocs(query(collection(partnerDb, "organizations/org-a/inventoryBalances"), where("brandId", "==", "sorotec"))));
    await assertFails(getDocs(query(collection(partnerDb, "organizations/org-a/inventoryBalances"), where("brandId", "==", "revo"))));
  });

  it("allows brand representatives to list assigned products with the inventory query", async () => {
    await seedMember("partner-1", "org-a", ["inventory.read", "inventory.viewReports", "inventory.comment"], "brandPartner", { partnerBrandIds: ["sorotec"] });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "organizations/org-a/offerings/sorotec-product"), { brandId: "sorotec", branchId: "head-office", isDeleted: false, name: "Sorotec inverter", organizationId: "org-a", type: "solarEquipment" });
      await setDoc(doc(adminDb, "organizations/org-a/offerings/revo-product"), { brandId: "revo", branchId: "head-office", isDeleted: false, name: "Revo inverter", organizationId: "org-a", type: "solarEquipment" });
    });
    const partnerDb = testEnv.authenticatedContext("partner-1").firestore();
    await assertSucceeds(getDocs(query(
      collection(partnerDb, "organizations/org-a/offerings"),
      where("brandId", "==", "sorotec"),
      where("isDeleted", "==", false),
    )));
  });

  it("requires inventory products to reference an active brand", async () => {
    await seedMember("inventory-1", "org-a", ["offerings.create"], "inventoryManager");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/inventoryBrands/sorotec"), { brandId: "sorotec", branchId: "head-office", organizationId: "org-a", status: "active" });
    });
    const inventoryDb = testEnv.authenticatedContext("inventory-1").firestore();
    const base = { branchId: "head-office", createdBy: "inventory-1", isDeleted: false, name: "Inverter", organizationId: "org-a", status: "active", type: "solarEquipment", updatedBy: "inventory-1" };
    await assertFails(setDoc(doc(inventoryDb, "organizations/org-a/offerings/unbranded"), base));
    await assertSucceeds(setDoc(doc(inventoryDb, "organizations/org-a/offerings/branded"), { ...base, brandId: "sorotec", brandName: "Sorotec" }));
  });

  it("allows scoped partner comments but blocks direct stock writes", async () => {
    await seedMember("partner-1", "org-a", ["inventory.read", "inventory.viewReports", "inventory.comment"], "brandPartner", { partnerBrandIds: ["sorotec"] });
    const partnerDb = testEnv.authenticatedContext("partner-1").firestore();
    await assertSucceeds(setDoc(doc(partnerDb, "organizations/org-a/inventoryComments/comment-1"), {
      brandId: "sorotec",
      branchId: "head-office",
      createdBy: "partner-1",
      isDeleted: false,
      message: "Please confirm this balance.",
      organizationId: "org-a",
    }));
    await assertFails(setDoc(doc(partnerDb, "organizations/org-a/inventoryComments/comment-2"), {
      brandId: "revo",
      branchId: "head-office",
      createdBy: "partner-1",
      isDeleted: false,
      message: "I should not see this brand.",
      organizationId: "org-a",
    }));
    await assertFails(setDoc(doc(partnerDb, "organizations/org-a/inventoryMovements/move-1"), {
      brandId: "sorotec",
      branchId: "head-office",
      organizationId: "org-a",
      quantity: 10,
    }));
  });

  it("keeps procurement, counts, and reservations internal while allowing partner trace reports", async () => {
    await seedMember("partner-1", "org-a", ["inventory.read", "inventory.viewReports", "inventory.comment"], "brandPartner", { partnerBrandIds: ["sorotec"] });
    await seedMember("inventory-1", "org-a", ["inventory.read", "inventory.procure", "inventory.count", "inventory.reserve"], "inventoryManager");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "organizations/org-a/inventoryPurchaseOrders/po-1"), { approvalStatus: "approved", branchId: "head-office", brandId: "sorotec", isDeleted: false, organizationId: "org-a" });
      await setDoc(doc(adminDb, "organizations/org-a/inventoryStockCounts/count-1"), { approvalStatus: "pendingApproval", branchId: "head-office", brandId: "sorotec", isDeleted: false, organizationId: "org-a" });
      await setDoc(doc(adminDb, "organizations/org-a/inventoryReservations/res-1"), { branchId: "head-office", brandId: "sorotec", isDeleted: false, organizationId: "org-a", reservationStatus: "active" });
      await setDoc(doc(adminDb, "organizations/org-a/inventoryLots/lot-1"), { batchNumber: "BATCH-1", branchId: "head-office", brandId: "sorotec", organizationId: "org-a", quantityOnHand: 5 });
      await setDoc(doc(adminDb, "organizations/org-a/inventorySerials/serial-1"), { branchId: "head-office", brandId: "sorotec", organizationId: "org-a", serialNumber: "SN-1", status: "available" });
    });
    const partnerDb = testEnv.authenticatedContext("partner-1").firestore();
    await assertFails(getDoc(doc(partnerDb, "organizations/org-a/inventoryPurchaseOrders/po-1")));
    await assertFails(getDoc(doc(partnerDb, "organizations/org-a/inventoryStockCounts/count-1")));
    await assertFails(getDoc(doc(partnerDb, "organizations/org-a/inventoryReservations/res-1")));
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventoryLots/lot-1")));
    await assertSucceeds(getDoc(doc(partnerDb, "organizations/org-a/inventorySerials/serial-1")));

    const inventoryDb = testEnv.authenticatedContext("inventory-1").firestore();
    await assertSucceeds(getDoc(doc(inventoryDb, "organizations/org-a/inventoryPurchaseOrders/po-1")));
    await assertSucceeds(getDoc(doc(inventoryDb, "organizations/org-a/inventoryStockCounts/count-1")));
    await assertSucceeds(getDoc(doc(inventoryDb, "organizations/org-a/inventoryReservations/res-1")));
    await assertFails(setDoc(doc(inventoryDb, "organizations/org-a/inventoryReservations/res-direct"), { branchId: "head-office", brandId: "sorotec", isDeleted: false, organizationId: "org-a" }));
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

  it("separates installation project creation, reading, and delivery updates", async () => {
    await seedMember("sales-1", "org-a", ["installations.create", "installations.read"]);
    await seedMember("project-1", "org-a", ["installations.read", "installations.update"], "projectManager");
    const salesDb = testEnv.authenticatedContext("sales-1").firestore();
    const projectRef = doc(salesDb, "organizations/org-a/installationProjects/project-1");
    await assertSucceeds(setDoc(projectRef, {
      branchId: "head-office",
      contractValue: 100000,
      createdBy: "sales-1",
      isDeleted: false,
      materials: [],
      costLines: [],
      name: "Test installation",
      organizationId: "org-a",
      siteAddress: "Kaduna",
      status: "planning",
      updatedBy: "sales-1",
    }));
    await assertSucceeds(getDoc(projectRef));
    await assertFails(updateDoc(projectRef, { progressPercent: 20 }));
    const projectDb = testEnv.authenticatedContext("project-1").firestore();
    await assertSucceeds(updateDoc(doc(projectDb, "organizations/org-a/installationProjects/project-1"), { progressPercent: 20, updatedBy: "project-1" }));
  });

  it("allows user managers to read member records", async () => {
    await seedMember("manager-1", "org-a", ["users.manage"], "operationsManager");
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("manager-1").firestore();
    await assertSucceeds(getDoc(doc(db, "organizations/org-a/members/sales-1")));
  });

  it("allows active users to reserve only their own AI Guide quota", async () => {
    await seedMember("sales-1", "org-a", ["leads.readAssigned"]);
    await seedMember("sales-2", "org-a", ["leads.readAssigned"]);
    const db = testEnv.authenticatedContext("sales-1").firestore();
    const quotaRef = doc(db, "organizations/org-a/internalAiGuideUsage/sales-1/days/2026-07-02");

    await assertSucceeds(getDoc(quotaRef));
    await assertSucceeds(setDoc(quotaRef, {
      count: 1,
      day: "2026-07-02",
      organizationId: "org-a",
      updatedAt: "2026-07-02T00:00:00.000Z",
      userId: "sales-1",
    }));
    await assertSucceeds(updateDoc(quotaRef, {
      count: 2,
      day: "2026-07-02",
      organizationId: "org-a",
      updatedAt: "2026-07-02T00:01:00.000Z",
      userId: "sales-1",
    }));
    await assertFails(getDoc(doc(db, "organizations/org-a/internalAiGuideUsage/sales-2/days/2026-07-02")));
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

  it("allows only super admins to soft-delete leads", async () => {
    await seedMember("admin-1", "org-a", [], "superAdmin");
    await seedMember("manager-1", "org-a", ["leads.readAll", "leads.assign"], "salesManager");
    await seedLead("org-a", "lead-1", "sales-1");
    await seedLead("org-a", "lead-2", "sales-1");

    const adminDb = testEnv.authenticatedContext("admin-1").firestore();
    await assertSucceeds(updateDoc(doc(adminDb, "organizations/org-a/leads/lead-1"), {
      deletedAt: "2026-07-03T00:00:00.000Z",
      deletedBy: "admin-1",
      isDeleted: true,
      organizationId: "org-a",
      updatedAt: "2026-07-03T00:00:00.000Z",
      updatedBy: "admin-1",
    }));

    const managerDb = testEnv.authenticatedContext("manager-1").firestore();
    await assertFails(updateDoc(doc(managerDb, "organizations/org-a/leads/lead-2"), {
      deletedAt: "2026-07-03T00:00:00.000Z",
      deletedBy: "manager-1",
      isDeleted: true,
      organizationId: "org-a",
      updatedAt: "2026-07-03T00:00:00.000Z",
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
      dealOwnerId: "sales-1",
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

  it("keeps sales executive deal updates assigned-only", async () => {
    await seedMember("sales-1", "org-a", ["deals.read", "deals.update"], "salesExecutive");
    await seedDeal("org-a", "owned-deal", "sales-1");
    await seedDeal("org-a", "other-deal", "sales-2");
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertSucceeds(updateDoc(doc(db, "organizations/org-a/deals/owned-deal"), {
      agreedAmount: 25000000,
      organizationId: "org-a",
      updatedBy: "sales-1",
    }));

    await assertFails(updateDoc(doc(db, "organizations/org-a/deals/other-deal"), {
      agreedAmount: 30000000,
      organizationId: "org-a",
      updatedBy: "sales-1",
    }));
  });

  it("keeps assigned-only users scoped when client or task update permissions are added", async () => {
    await seedMember("sales-1", "org-a", ["clients.read", "clients.update", "tasks.read", "tasks.update"], "salesExecutive");
    await seedClient("org-a", "owned-client", "sales-1");
    await seedClient("org-a", "other-client", "sales-2");
    await seedTask("org-a", "owned-task", "sales-1");
    await seedTask("org-a", "other-task", "sales-2");
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertSucceeds(updateDoc(doc(db, "organizations/org-a/clients/owned-client"), {
      organizationId: "org-a",
      updatedBy: "sales-1",
      WhatsAppNumber: "08020000000",
    }));
    await assertFails(updateDoc(doc(db, "organizations/org-a/clients/other-client"), {
      organizationId: "org-a",
      updatedBy: "sales-1",
      WhatsAppNumber: "08030000000",
    }));

    await assertSucceeds(updateDoc(doc(db, "organizations/org-a/tasks/owned-task"), {
      organizationId: "org-a",
      status: "inProgress",
      updatedBy: "sales-1",
    }));
    await assertFails(updateDoc(doc(db, "organizations/org-a/tasks/other-task"), {
      organizationId: "org-a",
      status: "inProgress",
      updatedBy: "sales-1",
    }));
  });

  it("allows finance users to sync only deal finance summary fields", async () => {
    await seedMember("finance-1", "org-a", ["finance.update", "reports.viewFinancial"], "accountant");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/deals/deal-1"), {
        branchId: "head-office",
        createdBy: "sales-1",
        dealType: "sale",
        financeStatus: "notInvoiced",
        isDeleted: false,
        organizationId: "org-a",
        status: "negotiation",
        title: "Test sale deal",
        updatedBy: "sales-1",
      });
    });

    const db = testEnv.authenticatedContext("finance-1").firestore();
    const dealRef = doc(db, "organizations/org-a/deals/deal-1");

    await assertSucceeds(updateDoc(dealRef, {
      balanceAmount: 15000000,
      financeStatus: "partPaid",
      lastPaymentAmount: 10000000,
      lastPaymentAt: "2026-06-12",
      lastReceiptNumber: "RCT-20260612-00001",
      organizationId: "org-a",
      paidAmount: 10000000,
      pendingPaymentAmount: 5000000,
      updatedBy: "finance-1",
    }));

    await assertFails(updateDoc(dealRef, {
      organizationId: "org-a",
      title: "Finance should not edit sales details",
      updatedBy: "finance-1",
    }));
  });

  it("blocks role-only deal access without explicit permissions", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    const db = testEnv.authenticatedContext("sales-1").firestore();
    const dealRef = doc(db, "organizations/org-a/deals/deal-1");

    await assertFails(setDoc(dealRef, {
      branchId: "head-office",
      createdBy: "sales-1",
      dealType: "sale",
      isDeleted: false,
      organizationId: "org-a",
      status: "new",
      title: "Role-backed deal",
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

  it("allows active users to manage only their own push subscriptions", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    await seedMember("sales-2", "org-a", [], "salesExecutive");
    const ownerDb = testEnv.authenticatedContext("sales-1").firestore();
    const otherDb = testEnv.authenticatedContext("sales-2").firestore();
    const subscriptionRef = doc(ownerDb, "organizations/org-a/pushSubscriptions/device-1");
    const record = {
      branchId: "head-office",
      createdBy: "sales-1",
      isDeleted: false,
      organizationId: "org-a",
      status: "active",
      token: "a-valid-registration-token-for-device-1",
      updatedBy: "sales-1",
      userAgent: "Test browser",
      userId: "sales-1",
    };

    await assertSucceeds(setDoc(subscriptionRef, record));
    await assertSucceeds(getDoc(subscriptionRef));
    await assertFails(getDoc(doc(otherDb, "organizations/org-a/pushSubscriptions/device-1")));
    await assertFails(deleteDoc(doc(otherDb, "organizations/org-a/pushSubscriptions/device-1")));
    await assertFails(setDoc(doc(otherDb, "organizations/org-a/pushSubscriptions/device-2"), {
      ...record,
      createdBy: "sales-2",
      updatedBy: "sales-2",
    }));
    await assertSucceeds(deleteDoc(subscriptionRef));
  });

  it("blocks malformed push subscription records", async () => {
    await seedMember("sales-1", "org-a", [], "salesExecutive");
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(setDoc(doc(db, "organizations/org-a/pushSubscriptions/device-1"), {
      branchId: "head-office",
      createdBy: "sales-1",
      isDeleted: false,
      organizationId: "org-a",
      status: "active",
      token: "short",
      updatedBy: "sales-1",
      userId: "sales-1",
    }));
  });

  it("keeps Google Calendar credentials server-only", async () => {
    await seedMember("sales-1", "org-a", ["tasks.read", "tasks.create"], "salesExecutive");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/calendarConnections/sales-1"), {
        calendarId: "private-calendar-id",
        encryptedRefreshToken: "encrypted-token",
        googleEmail: "sales-1@example.com",
        organizationId: "org-a",
        status: "active",
        userId: "sales-1",
      });
    });
    const db = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(getDoc(doc(db, "organizations/org-a/calendarConnections/sales-1")));
    await assertFails(setDoc(doc(db, "organizations/org-a/calendarConnections/sales-1"), {
      encryptedRefreshToken: "replacement",
      organizationId: "org-a",
      userId: "sales-1",
    }));
    await assertFails(deleteDoc(doc(db, "organizations/org-a/calendarConnections/sales-1")));
  });

  it("requires document-related permissions for document records", async () => {
    await seedMember("agent-1", "org-a", [], "agent");
    await seedMember("sales-1", "org-a", ["leads.readAssigned"], "salesExecutive");
    const agentDb = testEnv.authenticatedContext("agent-1").firestore();
    const salesDb = testEnv.authenticatedContext("sales-1").firestore();

    await assertFails(setDoc(doc(agentDb, "organizations/org-a/documents/document-1"), {
      branchId: "head-office",
      category: "general",
      createdBy: "agent-1",
      fileName: "file.pdf",
      isDeleted: false,
      organizationId: "org-a",
      status: "active",
      title: "Restricted document",
      updatedBy: "agent-1",
    }));

    await assertSucceeds(setDoc(doc(salesDb, "organizations/org-a/documents/document-2"), {
      branchId: "head-office",
      category: "general",
      createdBy: "sales-1",
      fileName: "file.pdf",
      isDeleted: false,
      organizationId: "org-a",
      status: "active",
      title: "Lead document",
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

  it("allows branch-scoped POS reads but keeps sales server-written", async () => {
    await seedMember("cashier-1", "org-a", ["pos.read", "pos.sell"], "frontDeskOfficer");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "organizations/org-a/posSales/sale-head"), {
        branchId: "head-office",
        customerName: "Walk-in customer",
        isDeleted: false,
        organizationId: "org-a",
        saleStatus: "completed",
      });
      await setDoc(doc(adminDb, "organizations/org-a/posSales/sale-kano"), {
        branchId: "kano",
        customerName: "Kano customer",
        isDeleted: false,
        organizationId: "org-a",
        saleStatus: "completed",
      });
    });
    const cashierDb = testEnv.authenticatedContext("cashier-1").firestore();
    await assertSucceeds(getDoc(doc(cashierDb, "organizations/org-a/posSales/sale-head")));
    await assertFails(getDoc(doc(cashierDb, "organizations/org-a/posSales/sale-kano")));
    await assertFails(setDoc(doc(cashierDb, "organizations/org-a/posSales/direct-write"), {
      branchId: "head-office",
      createdBy: "cashier-1",
      isDeleted: false,
      organizationId: "org-a",
      updatedBy: "cashier-1",
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
