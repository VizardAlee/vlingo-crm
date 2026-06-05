import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { rolePermissions } from "../src/lib/permissions";
import type { RoleName } from "../src/types/crm";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "beacon-operations-crm";
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "beacon-corporate-realty";

if (!getApps().length) {
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
}

const db = getFirestore();

function isKnownRole(role: unknown): role is RoleName {
  return typeof role === "string" && role in rolePermissions;
}

async function main() {
  const batch = db.batch();
  let writes = 0;

  Object.entries(rolePermissions).forEach(([role, permissions]) => {
    batch.set(
      db.doc(`organizations/${organizationId}/roles/${role}`),
      {
        name: role,
        organizationId,
        permissions,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    writes += 1;
  });

  const members = await db.collection(`organizations/${organizationId}/members`).get();
  members.docs.forEach((member) => {
    const role = member.data().role;
    if (!isKnownRole(role)) {
      console.warn(`Skipping member ${member.id}; unknown role: ${String(role)}`);
      return;
    }

    batch.set(
      member.ref,
      {
        permissions: rolePermissions[role],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    writes += 1;
  });

  await batch.commit();
  console.log(`Synced ${Object.keys(rolePermissions).length} roles and ${members.size} members in ${organizationId}.`);
  console.log(`Committed ${writes} Firestore writes to project ${projectId}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
