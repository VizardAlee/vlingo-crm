import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const callableOptions = { cors: true, invoker: "public" as const };
const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

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
    "deals.create",
    "deals.read",
    "deals.update",
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
    "finance.create",
    "finance.update",
    "finance.approve",
    "reports.viewFinancial",
    "users.manage",
    "roles.manage",
    "auditLogs.read",
  ],
  managingDirector: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "properties.read", "deals.read", "units.read", "rentals.read", "development.read", "marketing.read", "tasks.read", "activities.read", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  operationsManager: ["dashboard.viewExecutive", "leads.create", "leads.readAll", "leads.assign", "clients.create", "clients.read", "clients.update", "deals.create", "deals.read", "deals.update", "properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "rentals.create", "rentals.read", "rentals.update", "development.create", "development.read", "development.update", "marketing.create", "marketing.read", "marketing.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read", "users.manage"],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "marketing.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "deals.read", "rentals.create", "rentals.read", "rentals.update", "development.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "properties.read", "units.read", "deals.read", "rentals.read", "rentals.update", "activities.create", "activities.read", "finance.create", "finance.update", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "properties.read", "deals.read", "rentals.read", "rentals.update", "activities.create", "activities.read", "finance.create", "finance.update", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "properties.read", "deals.read", "rentals.read", "auditLogs.read"],
  projectManager: ["properties.read", "properties.update", "development.create", "development.read", "development.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "properties.read", "marketing.create", "marketing.read", "marketing.update", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "deals.read", "properties.read", "units.read", "rentals.read", "development.read", "marketing.read", "tasks.read", "activities.read", "auditLogs.read"],
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

function requireEmail(value: unknown) {
  const email = requireString(value, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  return email;
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

function smtpPort() {
  const value = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(value) ? value : 587;
}

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  const port = smtpPort();
  return {
    from,
    host,
    pass,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user,
  };
}

function inviteUrl() {
  if (!appBaseUrl) {
    return undefined;
  }

  return `${appBaseUrl.replace(/\/$/, "")}/login`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inviteEmailText(params: { displayName: string; setupLink: string }) {
  return [
    `Hello ${params.displayName},`,
    "",
    "You have been invited to Beacon Operations CRM.",
    "",
    "Use the link below to set your password and sign in:",
    params.setupLink,
    "",
    "If you were not expecting this invite, you can ignore this email.",
  ].join("\n");
}

function inviteEmailHtml(params: { displayName: string; setupLink: string }) {
  const displayName = escapeHtml(params.displayName);
  const setupLink = escapeHtml(params.setupLink);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <p>Hello ${displayName},</p>
      <p>You have been invited to Beacon Operations CRM.</p>
      <p><a href="${setupLink}" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Set password</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all">${setupLink}</p>
      <p>If you were not expecting this invite, you can ignore this email.</p>
    </div>
  `;
}

async function sendInviteEmail(params: { displayName: string; email: string }) {
  const config = smtpConfig();
  if (!config) {
    return { error: "SMTP is not configured for Cloud Functions.", sent: false };
  }

  try {
    const continueUrl = inviteUrl();
    const setupLink = await auth.generatePasswordResetLink(
      params.email,
      continueUrl ? { url: continueUrl } : undefined,
    );
    const transporter = nodemailer.createTransport({
      auth: {
        pass: config.pass,
        user: config.user,
      },
      host: config.host,
      port: config.port,
      secure: config.secure,
    });

    await transporter.sendMail({
      from: config.from,
      html: inviteEmailHtml({ displayName: params.displayName, setupLink }),
      subject: "You have been invited to Beacon Operations CRM",
      text: inviteEmailText({ displayName: params.displayName, setupLink }),
      to: params.email,
    });

    return { sent: true };
  } catch (error) {
    console.error("invite email delivery failed", error);
    const message = error instanceof Error ? error.message : "SMTP could not send the invite email.";
    return { error: message, sent: false };
  }
}

function inviteError(error: unknown) {
  if (error instanceof HttpsError) {
    return error;
  }

  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/invalid-email") {
    return new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  if (code === "auth/email-already-exists") {
    return new HttpsError("already-exists", "A Firebase Auth user already exists for this email.");
  }

  if (code === "auth/insufficient-permission") {
    return new HttpsError("permission-denied", "The Functions service account cannot manage Firebase Auth users. Grant it Firebase Authentication admin permissions.");
  }

  if (code === "auth/operation-not-allowed") {
    return new HttpsError("failed-precondition", "Firebase Authentication is not configured for email/password users.");
  }

  if (code === "7" || (typeof error === "object" && error && "details" in error && String(error.details).includes("Missing or insufficient permissions"))) {
    return new HttpsError(
      "permission-denied",
      "The Functions runtime service account cannot access Firestore. Grant it Cloud Datastore User permission, then try again.",
    );
  }

  console.error("provisionOrganizationMember failed", error);
  return new HttpsError("internal", "Unable to provision this user. Check Firebase Functions logs for details.");
}

export const provisionOrganizationMember = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  try {
    const organizationId = requireString(request.data?.organizationId, "organizationId");
    const branchId = requireString(request.data?.branchId, "branchId");
    const displayName = requireString(request.data?.displayName, "displayName");
    const email = requireEmail(request.data?.email);
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
    const inviteEmail = await sendInviteEmail({ displayName, email });

    await writeAuditLog({
      action: previous.exists ? "member.updateInvite" : "member.invite",
      actorId: request.auth.uid,
      actorName: actor.displayName,
      branchId,
      entityId: user.uid,
      entityType: "member",
      newValue: { branchId, displayName, email, role, setupEmailSent: inviteEmail.sent, status: "active" },
      organizationId,
      previousValue: previous.exists ? previous.data() : null,
    });

    return {
      email,
      setupEmailError: inviteEmail.sent ? undefined : inviteEmail.error,
      setupEmailSent: inviteEmail.sent,
      uid: user.uid,
    };
  } catch (error) {
    throw inviteError(error);
  }
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
