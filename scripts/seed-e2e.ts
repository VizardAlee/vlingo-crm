import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { rolePermissions } from "../src/lib/permissions";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "beacon-ops-crm";
const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "beacon-corporate-realty";
const branchId = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ?? "head-office";
const adminUid = process.env.E2E_ADMIN_UID ?? "e2e-admin";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@beacon.test";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2ePassword123!";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Run this seed through Firebase emulators so it cannot touch production data.");
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const auth = getAuth();
const db = getFirestore();

async function upsertAuthUser() {
  try {
    await auth.updateUser(adminUid, {
      disabled: false,
      displayName: "E2E Admin",
      email: adminEmail,
      emailVerified: true,
      password: adminPassword,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "auth/user-not-found") {
      await auth.createUser({
        disabled: false,
        displayName: "E2E Admin",
        email: adminEmail,
        emailVerified: true,
        password: adminPassword,
        uid: adminUid,
      });
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(adminUid, { organizationId, role: "superAdmin" });
}

async function seed() {
  await upsertAuthUser();

  await db.doc(`organizations/${organizationId}`).set({
    legalName: "Beacon Corporate Realty Limited",
    logoUrl: "/branding/beacon-logo.jpeg",
    name: "Beacon Corporate Realty Limited",
    primaryColor: "#b11226",
    status: "active",
  }, { merge: true });

  await db.doc(`organizations/${organizationId}/branches/${branchId}`).set({
    address: "Head office",
    code: "HQ",
    name: "Head Office",
    organizationId,
    status: "active",
  }, { merge: true });

  await Promise.all(Object.entries(rolePermissions).map(([role, permissions]) =>
    db.doc(`organizations/${organizationId}/roles/${role}`).set({
      name: role,
      organizationId,
      permissions,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ));

  await db.doc(`organizations/${organizationId}/members/${adminUid}`).set({
    branchId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "e2e-seed",
    displayName: "E2E Admin",
    email: adminEmail,
    organizationId,
    permissions: rolePermissions.superAdmin,
    role: "superAdmin",
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "e2e-seed",
  }, { merge: true });

  const common = {
    branchId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "e2e-seed",
    isDeleted: false,
    organizationId,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "e2e-seed",
  };

  await db.doc(`organizations/${organizationId}/properties/e2e-property`).set({
    ...common,
    address: "12 E2E Test Avenue, Lagos",
    askingPrice: 55000000,
    category: "Apartment",
    city: "Lagos",
    listingStatus: "listed",
    marketingStatus: "active",
    name: "E2E Beacon Apartments",
    propertyStatus: "available",
    referenceNumber: "PROP-E2E-001",
    state: "Lagos",
    transactionTypes: ["sale", "rent"],
  }, { merge: true });

  await db.doc(`organizations/${organizationId}/propertyUnits/e2e-unit`).set({
    ...common,
    askingPrice: 55000000,
    bedrooms: 3,
    propertyId: "e2e-property",
    propertyName: "E2E Beacon Apartments",
    propertyReferenceNumber: "PROP-E2E-001",
    referenceNumber: "UNIT-E2E-001",
    status: "available",
    unitNumber: "E2E-A1",
  }, { merge: true });

  console.log(`E2E seed completed for ${adminEmail}.`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
