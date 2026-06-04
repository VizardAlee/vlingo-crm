import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();

async function requireManager(uid: string, organizationId: string) {
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get();
  const permissions = member.data()?.permissions as string[] | undefined;

  if (!member.exists || member.data()?.status !== "active" || !permissions?.some((permission) => ["users.manage", "roles.manage"].includes(permission))) {
    throw new HttpsError("permission-denied", "You do not have permission to manage organization members.");
  }
}

export const provisionOrganizationMember = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { branchId, displayName, email, organizationId, permissions, role, uid } = request.data as {
    branchId: string;
    displayName: string;
    email: string;
    organizationId: string;
    permissions: string[];
    role: string;
    uid: string;
  };

  await requireManager(request.auth.uid, organizationId);
  await db.doc(`organizations/${organizationId}/members/${uid}`).set({
    branchId,
    displayName,
    email,
    organizationId,
    permissions,
    role,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await getAuth().setCustomUserClaims(uid, { organizationId, role });

  return { ok: true };
});

export const convertLeadToClient = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { leadId, organizationId } = request.data as { leadId: string; organizationId: string };
  const member = await db.doc(`organizations/${organizationId}/members/${request.auth.uid}`).get();
  const permissions = member.data()?.permissions as string[] | undefined;
  if (!member.exists || !permissions?.includes("clients.create")) {
    throw new HttpsError("permission-denied", "You cannot convert leads.");
  }

  const leadRef = db.doc(`organizations/${organizationId}/leads/${leadId}`);
  const clientRef = db.collection(`organizations/${organizationId}/clients`).doc();
  await db.runTransaction(async (transaction) => {
    const lead = await transaction.get(leadRef);
    if (!lead.exists) {
      throw new HttpsError("not-found", "Lead not found.");
    }

    const data = lead.data();
    transaction.set(clientRef, {
      branchId: data?.branchId,
      category: "buyer",
      clientType: "individual",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth?.uid,
      email: data?.email ?? "",
      fullName: data?.fullName,
      isDeleted: false,
      organizationId,
      phoneNumber: data?.phoneNumber,
      referenceNumber: `CLIENT-${Date.now()}`,
      status: "active",
      tags: data?.tags ?? [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid,
    });
    transaction.update(leadRef, { status: "converted", updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth?.uid });
  });

  return { clientId: clientRef.id };
});

export const writeProtectedAuditLog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { action, branchId, entityId, entityType, newValue, organizationId, previousValue } = request.data as Record<string, unknown>;
  await db.collection(`organizations/${organizationId}/auditLogs`).add({
    action,
    actorId: request.auth.uid,
    actorName: request.auth.token.email ?? request.auth.uid,
    branchId,
    createdAt: FieldValue.serverTimestamp(),
    entityId,
    entityType,
    newValue,
    organizationId,
    previousValue,
  });

  return { ok: true };
});
