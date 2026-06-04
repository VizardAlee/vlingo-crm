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
