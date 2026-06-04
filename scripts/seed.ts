import { initializeApp, cert } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { rolePermissions } from "../src/lib/permissions";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "beacon-ops-crm";
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp(
  privateKey
    ? {
        credential: cert({
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
          projectId,
        }),
        projectId,
      }
    : { projectId },
);

const db = getFirestore();
const organizationId = "beacon-corporate-realty";
const branchId = "head-office";
const systemUser = "seed-system";

async function seed() {
  await db.doc(`organizations/${organizationId}`).set({
    legalName: "Beacon Corporate Realty Limited",
    logoUrl: "/branding/beacon-logo.jpeg",
    name: "Beacon Corporate Realty Limited",
    primaryColor: "#b11226",
    status: "active",
  });

  await db.doc(`organizations/${organizationId}/branches/${branchId}`).set({
    address: "Head office",
    code: "HQ",
    name: "Head Office",
    organizationId,
    status: "active",
  });

  await Promise.all(
    Object.entries(rolePermissions).map(([role, permissions]) =>
      db.doc(`organizations/${organizationId}/roles/${role}`).set({
        name: role,
        permissions,
        organizationId,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ),
  );

  await db.doc(`organizations/${organizationId}/members/dev-admin`).set({
    branchId,
    displayName: "Development Admin",
    email: "admin@beacon.test",
    organizationId,
    permissions: rolePermissions.superAdmin,
    role: "superAdmin",
    status: "active",
  });

  const common = {
    branchId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: systemUser,
    isDeleted: false,
    organizationId,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: systemUser,
  };

  await db.collection(`organizations/${organizationId}/leads`).add({
    ...common,
    assignedTo: "dev-admin",
    budgetMaximum: 25000000,
    budgetMinimum: 10000000,
    fullName: "Ada Okafor",
    phoneNumber: "+234 801 000 0001",
    referenceNumber: "LEAD-DEV-001",
    score: 72,
    source: "Website",
    status: "qualified",
    tags: ["buyer", "lekki"],
    transactionInterest: "buy",
  });

  await db.collection(`organizations/${organizationId}/clients`).add({
    ...common,
    category: "buyer",
    clientType: "individual",
    fullName: "Chinedu Nwosu",
    phoneNumber: "+234 802 000 0002",
    referenceNumber: "CLIENT-DEV-001",
    status: "active",
    tags: ["investor"],
  });

  const property = await db.collection(`organizations/${organizationId}/properties`).add({
    ...common,
    address: "Lekki Phase 1, Lagos",
    askingPrice: 45000000,
    category: "apartment",
    city: "Lagos",
    features: ["secure estate", "parking"],
    listingStatus: "listed",
    marketingStatus: "active",
    name: "Beacon Lekki Apartments",
    propertyStatus: "available",
    referenceNumber: "PROP-DEV-001",
    state: "Lagos",
    transactionTypes: ["sale", "rent"],
  });

  await db.collection(`organizations/${organizationId}/propertyUnits`).add({
    ...common,
    askingPrice: 45000000,
    bedrooms: 3,
    propertyId: property.id,
    referenceNumber: "UNIT-DEV-001",
    status: "available",
    unitNumber: "A-01",
  });

  await db.collection(`organizations/${organizationId}/tasks`).add({
    ...common,
    assignedTo: "dev-admin",
    priority: "high",
    status: "notStarted",
    title: "Follow up with qualified Lekki buyer",
  });

  await db.collection(`organizations/${organizationId}/activities`).add({
    ...common,
    relatedEntityType: "lead",
    status: "completed",
    subject: "Initial qualification call",
    type: "phoneCall",
  });

  console.log("Development seed completed for Beacon Corporate Realty Limited.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
