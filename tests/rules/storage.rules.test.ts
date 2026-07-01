import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, uploadString } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { readFileSync } from "node:fs";

let testEnv: RulesTestEnvironment;

describe("Beacon Storage rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "beacon-operations-crm",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
      storage: {
        rules: readFileSync("storage.rules", "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/members/manager-1"), {
        branchId: "head-office",
        organizationId: "org-a",
        permissions: ["properties.read"],
        role: "propertyManager",
        status: "active",
      });
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("blocks uploads into another organization", async () => {
    const storage = testEnv.authenticatedContext("manager-1").storage();
    await assertFails(uploadString(ref(storage, "organizations/org-b/properties/file.txt"), "unsafe"));
  });

  it("blocks uploads for users without a member record", async () => {
    const storage = testEnv.authenticatedContext("missing-member").storage();
    await assertFails(uploadString(ref(storage, "organizations/org-a/properties/file.txt"), "unsafe"));
  });

  it("blocks unauthenticated uploads without null rule errors", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadString(ref(storage, "organizations/org-a/properties/file.txt"), "unsafe"));
  });

  it("allows permitted uploads in the user's organization", async () => {
    const storage = testEnv.authenticatedContext("manager-1").storage();
    await assertSucceeds(uploadString(ref(storage, "organizations/org-a/properties/file.txt"), "safe"));
  });

  it("allows organization managers to upload branding images", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/members/admin-1"), {
        branchId: "head-office",
        organizationId: "org-a",
        permissions: ["users.manage"],
        role: "operationsManager",
        status: "active",
      });
    });

    const storage = testEnv.authenticatedContext("admin-1").storage();
    await assertSucceeds(uploadString(ref(storage, "organizations/org-a/branding/logo.png"), "safe", "raw", { contentType: "image/png" }));
  });

  it("blocks branding uploads for non-managers or non-images", async () => {
    const storage = testEnv.authenticatedContext("manager-1").storage();
    await assertFails(uploadString(ref(storage, "organizations/org-a/branding/logo.png"), "safe", "raw", { contentType: "image/png" }));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "organizations/org-a/members/admin-1"), {
        branchId: "head-office",
        organizationId: "org-a",
        permissions: ["users.manage"],
        role: "operationsManager",
        status: "active",
      });
    });

    const adminStorage = testEnv.authenticatedContext("admin-1").storage();
    await assertFails(uploadString(ref(adminStorage, "organizations/org-a/branding/logo.txt"), "unsafe", "raw", { contentType: "text/plain" }));
  });
});
