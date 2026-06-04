import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rolePermissions } from "../src/lib/permissions";

const uid = process.env.FIRST_ADMIN_UID;
const email = process.env.FIRST_ADMIN_EMAIL;
const displayName = process.env.FIRST_ADMIN_NAME ?? "Beacon Admin";
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "beacon-operations-crm";
const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "beacon-corporate-realty";
const branchId = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ?? "head-office";

if (!uid || !email) {
  console.error("Missing FIRST_ADMIN_UID or FIRST_ADMIN_EMAIL.");
  console.error("Example:");
  console.error('FIRST_ADMIN_UID="firebase-auth-uid" FIRST_ADMIN_EMAIL="you@example.com" npm run create:first-admin');
  process.exit(1);
}

initializeApp({ projectId });

const db = getFirestore();

async function main() {
  await db.doc(`organizations/${organizationId}`).set(
    {
      legalName: "Beacon Corporate Realty Limited",
      logoUrl: "/branding/beacon-logo.jpeg",
      name: "Beacon Corporate Realty Limited",
      primaryColor: "#b11226",
      status: "active",
    },
    { merge: true },
  );

  await db.doc(`organizations/${organizationId}/branches/${branchId}`).set(
    {
      address: "Head office",
      code: "HQ",
      name: "Head Office",
      organizationId,
      status: "active",
    },
    { merge: true },
  );

  await db.doc(`organizations/${organizationId}/members/${uid}`).set(
    {
      branchId,
      displayName,
      email,
      organizationId,
      permissions: rolePermissions.superAdmin,
      role: "superAdmin",
      status: "active",
    },
    { merge: true },
  );

  await Promise.all(
    Object.entries(rolePermissions).map(([role, permissions]) =>
      db.doc(`organizations/${organizationId}/roles/${role}`).set(
        {
          name: role,
          organizationId,
          permissions,
        },
        { merge: true },
      ),
    ),
  );

  console.log(`First admin member created for ${email} (${uid}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
