import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const callableOptions = { cors: true, invoker: "public" as const };

const rolePermissions = {
  superAdmin: [
    "dashboard.viewExecutive",
    "leads.create",
    "leads.readAssigned",
    "leads.readAll",
    "leads.updateAssigned",
    "leads.assign",
    "clients.create",
    "clients.read",
    "clients.update",
    "properties.create",
    "properties.read",
    "properties.update",
    "properties.approve",
    "units.create",
    "units.read",
    "units.update",
    "rentals.create",
    "rentals.read",
    "rentals.update",
    "development.create",
    "development.read",
    "development.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
    "reports.viewFinancial",
    "users.manage",
    "roles.manage",
    "auditLogs.read",
  ],
  managingDirector: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "properties.read", "units.read", "rentals.read", "development.read", "marketing.read", "tasks.read", "activities.read", "reports.viewFinancial", "auditLogs.read"],
  operationsManager: ["dashboard.viewExecutive", "leads.create", "leads.readAll", "leads.assign", "clients.create", "clients.read", "clients.update", "properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "rentals.create", "rentals.read", "rentals.update", "development.create", "development.read", "development.update", "marketing.create", "marketing.read", "marketing.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read", "users.manage"],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "marketing.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "rentals.create", "rentals.read", "rentals.update", "development.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "properties.read", "units.read", "rentals.read", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "properties.read", "rentals.read", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "properties.read", "rentals.read", "auditLogs.read"],
  projectManager: ["properties.read", "properties.update", "development.create", "development.read", "development.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "properties.read", "marketing.create", "marketing.read", "marketing.update", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "properties.read", "units.read", "rentals.read", "development.read", "marketing.read", "tasks.read", "activities.read", "auditLogs.read"],
} as const;

type RoleName = keyof typeof rolePermissions;

interface ActorContext {
  displayName: string;
  permissions: string[];
  role: string;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }

  return value.trim();
}

function requireRole(value: unknown) {
  const role = requireString(value, "role");
  if (!(role in rolePermissions)) {
    throw new HttpsError("invalid-argument", "Unsupported role.");
  }

  return role as RoleName;
}

function isPrivilegedRole(role: RoleName) {
  return role === "superAdmin" || role === "managingDirector" || rolePermissions[role].some((permission) => ["users.manage", "roles.manage"].includes(permission));
}

async function getActor(uid: string, organizationId: string): Promise<ActorContext> {
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get();
  const data = member.data();
  const permissions = data?.permissions as string[] | undefined;

  if (!member.exists || data?.status !== "active" || !permissions?.includes("users.manage")) {
    throw new HttpsError("permission-denied", "You do not have permission to manage organization members.");
  }

  return {
    displayName: typeof data?.displayName === "string" ? data.displayName : uid,
    permissions,
    role: typeof data?.role === "string" ? data.role : "unknown",
  };
}

function assertCanAssignRole(actor: ActorContext, role: RoleName) {
  if (isPrivilegedRole(role) && !actor.permissions.includes("roles.manage")) {
    throw new HttpsError("permission-denied", "You cannot assign privileged roles.");
  }
}

async function writeAuditLog(params: {
  action: string;
  actorId: string;
  actorName: string;
  branchId: string;
  entityId: string;
  entityType: string;
  newValue?: unknown;
  organizationId: string;
  previousValue?: unknown;
}) {
  await db.collection(`organizations/${params.organizationId}/auditLogs`).add({
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName,
    branchId: params.branchId,
    createdAt: FieldValue.serverTimestamp(),
    entityId: params.entityId,
    entityType: params.entityType,
    newValue: params.newValue ?? null,
    organizationId: params.organizationId,
    previousValue: params.previousValue ?? null,
  });
}

async function getOrCreateUser(email: string, displayName: string): Promise<UserRecord> {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "auth/user-not-found") {
      return auth.createUser({
        disabled: false,
        displayName,
        email,
        emailVerified: false,
      });
    }

    throw error;
  }
}

export const provisionOrganizationMember = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const branchId = requireString(request.data?.branchId, "branchId");
  const displayName = requireString(request.data?.displayName, "displayName");
  const email = requireString(request.data?.email, "email").toLowerCase();
  const role = requireRole(request.data?.role);
  const phoneNumber = typeof request.data?.phoneNumber === "string" ? request.data.phoneNumber.trim() : "";
  const actor = await getActor(request.auth.uid, organizationId);
  assertCanAssignRole(actor, role);

  const user = await getOrCreateUser(email, displayName);
  await auth.updateUser(user.uid, { disabled: false, displayName });
  await auth.setCustomUserClaims(user.uid, { organizationId, role });

  const memberRef = db.doc(`organizations/${organizationId}/members/${user.uid}`);
  const previous = await memberRef.get();
  const payload = {
    branchId,
    createdAt: previous.exists ? previous.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    createdBy: previous.exists ? previous.data()?.createdBy ?? request.auth.uid : request.auth.uid,
    displayName,
    email,
    organizationId,
    permissions: [...rolePermissions[role]],
    phoneNumber,
    role,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  };

  await memberRef.set(payload, { merge: true });
  await writeAuditLog({
    action: previous.exists ? "member.updateInvite" : "member.invite",
    actorId: request.auth.uid,
    actorName: actor.displayName,
    branchId,
    entityId: user.uid,
    entityType: "member",
    newValue: { branchId, displayName, email, role, status: "active" },
    organizationId,
    previousValue: previous.exists ? previous.data() : null,
  });

  return { email, uid: user.uid };
});

export const updateOrganizationMemberRole = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const branchId = requireString(request.data?.branchId, "branchId");
  const targetUid = requireString(request.data?.uid, "uid");
  const role = requireRole(request.data?.role);
  const actor = await getActor(request.auth.uid, organizationId);
  assertCanAssignRole(actor, role);

  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You cannot change your own role or branch.");
  }

  const memberRef = db.doc(`organizations/${organizationId}/members/${targetUid}`);
  const previous = await memberRef.get();
  if (!previous.exists) {
    throw new HttpsError("not-found", "Member not found.");
  }

  await memberRef.update({
    branchId,
    permissions: [...rolePermissions[role]],
    role,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });
  await auth.setCustomUserClaims(targetUid, { organizationId, role });
  await writeAuditLog({
    action: "member.roleBranchUpdate",
    actorId: request.auth.uid,
    actorName: actor.displayName,
    branchId,
    entityId: targetUid,
    entityType: "member",
    newValue: { branchId, role },
    organizationId,
    previousValue: previous.data(),
  });

  return { ok: true };
});

export const disableOrganizationMember = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const targetUid = requireString(request.data?.uid, "uid");
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You cannot disable your own account.");
  }

  const actor = await getActor(request.auth.uid, organizationId);
  const memberRef = db.doc(`organizations/${organizationId}/members/${targetUid}`);
  const previous = await memberRef.get();
  if (!previous.exists) {
    throw new HttpsError("not-found", "Member not found.");
  }

  await auth.updateUser(targetUid, { disabled: true });
  await memberRef.update({ status: "disabled", updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
  await writeAuditLog({
    action: "member.disable",
    actorId: request.auth.uid,
    actorName: actor.displayName,
    branchId: String(previous.data()?.branchId ?? ""),
    entityId: targetUid,
    entityType: "member",
    newValue: { status: "disabled" },
    organizationId,
    previousValue: previous.data(),
  });

  return { ok: true };
});

export const reactivateOrganizationMember = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const targetUid = requireString(request.data?.uid, "uid");
  const actor = await getActor(request.auth.uid, organizationId);
  const memberRef = db.doc(`organizations/${organizationId}/members/${targetUid}`);
  const previous = await memberRef.get();
  if (!previous.exists) {
    throw new HttpsError("not-found", "Member not found.");
  }

  await auth.updateUser(targetUid, { disabled: false });
  await memberRef.update({ status: "active", updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
  await writeAuditLog({
    action: "member.reactivate",
    actorId: request.auth.uid,
    actorName: actor.displayName,
    branchId: String(previous.data()?.branchId ?? ""),
    entityId: targetUid,
    entityType: "member",
    newValue: { status: "active" },
    organizationId,
    previousValue: previous.data(),
  });

  return { ok: true };
});

export const convertLeadToClient = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { leadId, organizationId } = request.data as { leadId: string; organizationId: string };
  const member = await db.doc(`organizations/${organizationId}/members/${request.auth.uid}`).get();
  const memberData = member.data();
  const permissions = memberData?.permissions as string[] | undefined;
  if (!member.exists || !permissions?.includes("clients.create")) {
    throw new HttpsError("permission-denied", "You cannot convert leads.");
  }

  const leadRef = db.doc(`organizations/${organizationId}/leads/${leadId}`);
  const clientRef = db.collection(`organizations/${organizationId}/clients`).doc();
  let convertedLead: DocumentData | undefined;
  await db.runTransaction(async (transaction) => {
    const lead = await transaction.get(leadRef);
    if (!lead.exists) {
      throw new HttpsError("not-found", "Lead not found.");
    }

    const data = lead.data();
    if (data?.status === "converted") {
      throw new HttpsError("failed-precondition", "Lead has already been converted.");
    }

    if (data?.status === "lost") {
      throw new HttpsError("failed-precondition", "Lost leads must be reopened before conversion.");
    }

    convertedLead = data;
    const stageHistory = Array.isArray(data?.stageHistory) ? data.stageHistory : [];
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
    transaction.update(leadRef, {
      clientId: clientRef.id,
      convertedAt: FieldValue.serverTimestamp(),
      convertedBy: request.auth?.uid,
      lastContactAt: FieldValue.serverTimestamp(),
      stageHistory: [
        ...stageHistory,
        {
          at: new Date().toISOString(),
          from: data?.status ?? "new",
          note: "Lead converted to client after confirmed commitment.",
          to: "converted",
          userId: request.auth?.uid,
        },
      ],
      status: "converted",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid,
    });
  });

  await db.collection(`organizations/${organizationId}/activities`).add({
    body: `Client record created from lead ${leadId}.`,
    branchId: convertedLead?.branchId ?? memberData?.branchId ?? "",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    isDeleted: false,
    organizationId,
    referenceNumber: `ACT-${Date.now()}`,
    relatedEntityId: leadId,
    relatedEntityType: "lead",
    status: "completed",
    subject: "Lead converted to client",
    type: "internalNote",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });

  await writeAuditLog({
    action: "lead.convert",
    actorId: request.auth.uid,
    actorName: String(memberData?.displayName ?? request.auth.token.email ?? request.auth.uid),
    branchId: String(convertedLead?.branchId ?? memberData?.branchId ?? ""),
    entityId: leadId,
    entityType: "lead",
    newValue: { clientId: clientRef.id, status: "converted" },
    organizationId,
    previousValue: convertedLead,
  });

  return { clientId: clientRef.id };
});

export const writeProtectedAuditLog = onCall(callableOptions, async (request) => {
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
