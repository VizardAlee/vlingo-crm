import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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
const firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const firebaseCliClientId = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const firebaseCliClientSecret = "j9iVZfS8kkCEFUPaAeJV0sAi";

function isKnownRole(role: unknown): role is RoleName {
  return typeof role === "string" && role in rolePermissions;
}

function normalizeRoles(role: unknown, roles: unknown): RoleName[] {
  const assignedRoles = Array.isArray(roles) ? roles : [];
  return Array.from(new Set([role, ...assignedRoles].filter(isKnownRole)));
}

function permissionsForAssignedRoles(roles: RoleName[]) {
  return Array.from(new Set(roles.flatMap((role) => rolePermissions[role])));
}

async function syncWithAdminSdk() {
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
    const assignedRoles = normalizeRoles(member.data().role, member.data().roles);
    if (!assignedRoles.length) {
      console.warn(`Skipping member ${member.id}; no known roles assigned.`);
      return;
    }

    batch.set(
      member.ref,
      {
        permissions: permissionsForAssignedRoles(assignedRoles),
        roles: assignedRoles,
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

function firestoreString(value: string) {
  return { stringValue: value };
}

function firestoreStringArray(values: readonly string[]) {
  return { arrayValue: { values: values.map((value) => firestoreString(value)) } };
}

function firestoreFields(fields: Record<string, unknown>) {
  return { fields };
}

function readFirebaseCliRefreshToken() {
  const configPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { tokens?: { refresh_token?: string } };
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error("Firebase CLI refresh token was not found. Run firebase login --reauth.");
  }

  return refreshToken;
}

async function getFirebaseCliAccessToken() {
  const params = new URLSearchParams({
    client_id: firebaseCliClientId,
    client_secret: firebaseCliClientSecret,
    grant_type: "refresh_token",
    refresh_token: readFirebaseCliRefreshToken(),
  });

  const response = await fetch("https://www.googleapis.com/oauth2/v3/token", {
    body: params,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Unable to refresh Firebase CLI access token: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Firebase CLI token refresh did not return an access token.");
  }

  return payload.access_token;
}

async function firestoreRequest<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${firestoreBaseUrl}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Firestore REST request failed: ${response.status} ${await response.text()}`);
  }

  return await response.json() as T;
}

async function patchFirestoreDocument(accessToken: string, path: string, fields: Record<string, unknown>) {
  const updateMask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join("&");
  await firestoreRequest(accessToken, `${path}?${updateMask}`, {
    body: JSON.stringify(firestoreFields(fields)),
    method: "PATCH",
  });
}

async function syncWithFirebaseCliRest() {
  const accessToken = await getFirebaseCliAccessToken();
  let writes = 0;

  await Promise.all(Object.entries(rolePermissions).map(async ([role, permissions]) => {
    await patchFirestoreDocument(accessToken, `organizations/${organizationId}/roles/${role}`, {
      name: firestoreString(role),
      organizationId: firestoreString(organizationId),
      permissions: firestoreStringArray(permissions),
      updatedAt: { timestampValue: new Date().toISOString() },
    });
    writes += 1;
  }));

  const membersResponse = await firestoreRequest<{ documents?: Array<{ fields?: { role?: { stringValue?: string }; roles?: { arrayValue?: { values?: Array<{ stringValue?: string }> } } }; name: string }> }>(
    accessToken,
    `organizations/${organizationId}/members`,
  );
  const members = membersResponse.documents ?? [];

  await Promise.all(members.map(async (member) => {
    const role = member.fields?.role?.stringValue;
    const roles = member.fields?.roles?.arrayValue?.values?.map((value) => value.stringValue).filter(Boolean) ?? [];
    const assignedRoles = normalizeRoles(role, roles);
    if (!assignedRoles.length) {
      console.warn(`Skipping member ${member.name}; no known roles assigned.`);
      return;
    }

    const relativePath = member.name.split("/documents/")[1];
    await patchFirestoreDocument(accessToken, relativePath, {
      permissions: firestoreStringArray(permissionsForAssignedRoles(assignedRoles)),
      roles: firestoreStringArray(assignedRoles),
      updatedAt: { timestampValue: new Date().toISOString() },
    });
    writes += 1;
  }));

  console.log(`Synced ${Object.keys(rolePermissions).length} roles and ${members.length} members in ${organizationId}.`);
  console.log(`Committed ${writes} Firestore REST writes to project ${projectId}.`);
}

function isReauthError(error: unknown) {
  return error instanceof Error && (error.message.includes("invalid_rapt") || error.message.includes("invalid_grant"));
}

async function main() {
  try {
    await syncWithAdminSdk();
  } catch (error) {
    if (!isReauthError(error)) {
      throw error;
    }

    console.warn("Admin SDK credentials require gcloud reauthentication; retrying with Firebase CLI credentials.");
    await syncWithFirebaseCliRest();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
