import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const callableOptions = { cors: true, invoker: "public" as const };
const mailSettingsSecretOptions = { ...callableOptions, secrets: ["MAIL_SETTINGS_ENCRYPTION_KEY"] };
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
  branchId: string;
  displayName: string;
  email: string;
  permissions: string[];
  role: string;
}

interface EmailSettingsPayload {
  enabled: boolean;
  host: string;
  password?: string;
  port: number;
  replyTo?: string;
  secureMode: "none" | "ssl" | "starttls";
  senderEmail: string;
  senderName: string;
  username: string;
}

interface SalesJourneyEmailPayload {
  body: string;
  leadId: string;
  organizationId: string;
  recipient?: string;
  subject: string;
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

function requireNumber(value: unknown, field: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new HttpsError("invalid-argument", `${field} must be a number.`);
  }

  return number;
}

function requireSecureMode(value: unknown) {
  const mode = typeof value === "string" ? value : "";
  if (!["none", "ssl", "starttls"].includes(mode)) {
    throw new HttpsError("invalid-argument", "secureMode must be none, ssl, or starttls.");
  }

  return mode as EmailSettingsPayload["secureMode"];
}

function smtpSendError(error: unknown, host: string) {
  const record = typeof error === "object" && error ? error as Record<string, unknown> : {};
  const code = typeof record.code === "string" ? record.code : "";
  const command = typeof record.command === "string" ? record.command : "";
  const response = typeof record.response === "string" ? record.response : "";
  const responseCode = typeof record.responseCode === "number" ? record.responseCode : undefined;

  console.error("sendEmailSmtpTest failed", { code, command, host, responseCode });

  if (["EDNS", "ENOTFOUND"].includes(code)) {
    return new HttpsError("failed-precondition", `SMTP host "${host}" could not be found. Check the spelling. For Google Workspace, use smtp.gmail.com.`);
  }

  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED"].includes(code)) {
    return new HttpsError("failed-precondition", `Unable to connect to ${host}. Check the SMTP host, port, security mode, and whether your provider allows SMTP connections.`);
  }

  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return new HttpsError("failed-precondition", "SMTP authentication failed. Check the username and password. Google Workspace, Gmail, Microsoft 365, and Outlook may require an app password or SMTP auth to be enabled.");
  }

  if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) {
    return new HttpsError("failed-precondition", "The SMTP provider rejected the sender or recipient address. Check the sender email, reply-to email, and test recipient.");
  }

  return new HttpsError("internal", response || "Unable to send test email. Check the SMTP settings and provider logs.");
}

function isPrivilegedRole(role: RoleName) {
  return role === "superAdmin" || role === "managingDirector" || rolePermissions[role].some((permission) => ["users.manage", "roles.manage"].includes(permission));
}

function isPrivilegedMember(data: DocumentData | undefined) {
  const memberRole = typeof data?.role === "string" && data.role in rolePermissions ? data.role as RoleName : null;
  const permissions = Array.isArray(data?.permissions) ? data.permissions as string[] : [];
  return Boolean(memberRole && isPrivilegedRole(memberRole)) || permissions.some((permission) => ["users.manage", "roles.manage"].includes(permission));
}

async function getActor(uid: string, organizationId: string): Promise<ActorContext> {
  const actor = await getActiveMember(uid, organizationId);

  if (!actor.permissions.includes("users.manage")) {
    throw new HttpsError("permission-denied", "You do not have permission to manage organization members.");
  }

  return actor;
}

async function getActiveMember(uid: string, organizationId: string): Promise<ActorContext> {
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get();
  const data = member.data();
  const permissions = data?.permissions as string[] | undefined;

  if (!member.exists || data?.status !== "active" || !permissions) {
    throw new HttpsError("permission-denied", "You do not have access to this organization.");
  }

  return {
    branchId: typeof data?.branchId === "string" ? data.branchId : "",
    displayName: typeof data?.displayName === "string" ? data.displayName : uid,
    email: typeof data?.email === "string" ? data.email : "",
    permissions,
    role: typeof data?.role === "string" ? data.role : "unknown",
  };
}

function assertCanAssignRole(actor: ActorContext, role: RoleName) {
  if (isPrivilegedRole(role) && !actor.permissions.includes("roles.manage")) {
    throw new HttpsError("permission-denied", "You cannot assign privileged roles.");
  }
}

function assertCanManageTargetMember(actor: ActorContext, target: DocumentData | undefined) {
  if (isPrivilegedMember(target) && !actor.permissions.includes("roles.manage")) {
    throw new HttpsError("permission-denied", "You cannot manage privileged users.");
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

function encryptionKey() {
  const secret = process.env.MAIL_SETTINGS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new HttpsError("failed-precondition", "MAIL_SETTINGS_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new HttpsError("failed-precondition", "Saved SMTP password is not readable.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseEmailSettingsPayload(data: unknown): EmailSettingsPayload {
  const record = typeof data === "object" && data ? data as Record<string, unknown> : {};
  const port = requireNumber(record.port, "port");
  if (port < 1 || port > 65535) {
    throw new HttpsError("invalid-argument", "port must be between 1 and 65535.");
  }
  const host = requireString(record.host, "host").toLowerCase();
  if (host === "stmp.gmail.com") {
    throw new HttpsError("invalid-argument", "Use smtp.gmail.com, not stmp.gmail.com.");
  }

  return {
    enabled: record.enabled === true,
    host,
    password: typeof record.password === "string" && record.password ? record.password : undefined,
    port,
    replyTo: typeof record.replyTo === "string" && record.replyTo.trim() ? requireEmail(record.replyTo) : undefined,
    secureMode: requireSecureMode(record.secureMode),
    senderEmail: requireEmail(record.senderEmail),
    senderName: requireString(record.senderName, "senderName"),
    username: requireString(record.username, "username"),
  };
}

function parseSalesJourneyEmailPayload(data: unknown): SalesJourneyEmailPayload {
  const record = typeof data === "object" && data ? data as Record<string, unknown> : {};
  return {
    body: requireString(record.body, "body"),
    leadId: requireString(record.leadId, "leadId"),
    organizationId: requireString(record.organizationId, "organizationId"),
    recipient: typeof record.recipient === "string" && record.recipient.trim() ? requireEmail(record.recipient) : undefined,
    subject: requireString(record.subject, "subject"),
  };
}

function sanitizeEmailSettings(data: DocumentData | undefined, member: ActorContext) {
  return {
    enabled: data?.enabled === true,
    hasPassword: typeof data?.encryptedPassword === "string" && Boolean(data.encryptedPassword),
    host: typeof data?.host === "string" ? data.host : "",
    port: typeof data?.port === "number" ? data.port : 587,
    replyTo: typeof data?.replyTo === "string" ? data.replyTo : "",
    secureMode: typeof data?.secureMode === "string" ? data.secureMode : "starttls",
    senderEmail: typeof data?.senderEmail === "string" ? data.senderEmail : member.email,
    senderName: typeof data?.senderName === "string" ? data.senderName : member.displayName,
    username: typeof data?.username === "string" ? data.username : member.email,
    updatedAt: data?.updatedAt ?? null,
  };
}

function emailSettingsDoc(organizationId: string, uid: string) {
  return db.doc(`organizations/${organizationId}/mailSettings/${uid}`);
}

function smtpTransport(settings: DocumentData) {
  if (!settings.encryptedPassword || typeof settings.encryptedPassword !== "string") {
    throw new HttpsError("failed-precondition", "Save your SMTP password before sending a test email.");
  }

  const secureMode = settings.secureMode === "ssl" ? "ssl" : settings.secureMode === "none" ? "none" : "starttls";
  return nodemailer.createTransport({
    auth: {
      pass: decryptSecret(settings.encryptedPassword),
      user: String(settings.username),
    },
    host: String(settings.host),
    port: Number(settings.port),
    requireTLS: secureMode === "starttls",
    secure: secureMode === "ssl",
  });
}

function formattedSender(settings: DocumentData) {
  const name = String(settings.senderName ?? "").replace(/"/g, "'");
  return name ? `"${name}" <${String(settings.senderEmail)}>` : String(settings.senderEmail);
}

async function getUsableEmailSettings(organizationId: string, uid: string) {
  const snapshot = await emailSettingsDoc(organizationId, uid).get();
  const settings = snapshot.data();
  if (!snapshot.exists || !settings) {
    throw new HttpsError("failed-precondition", "Save your SMTP settings before sending email.");
  }

  if (settings.enabled !== true) {
    throw new HttpsError("failed-precondition", "Your SMTP mailbox is disabled. Enable it in Email Settings before sending email.");
  }

  return settings;
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

function inviteUrl() {
  if (!appBaseUrl) {
    return undefined;
  }

  return `${appBaseUrl.replace(/\/$/, "")}/invite/setup`;
}

function appInviteSetupLink(firebaseLink: string, email: string) {
  const setupUrl = inviteUrl();
  if (!setupUrl) {
    return firebaseLink;
  }

  try {
    const source = new URL(firebaseLink);
    const oobCode = source.searchParams.get("oobCode");
    const mode = source.searchParams.get("mode") ?? "resetPassword";
    if (!oobCode) {
      return firebaseLink;
    }

    const target = new URL(setupUrl);
    target.searchParams.set("mode", mode);
    target.searchParams.set("oobCode", oobCode);
    target.searchParams.set("email", email);
    return target.toString();
  } catch {
    return firebaseLink;
  }
}

async function generateInviteLink(email: string) {
  const continueUrl = inviteUrl();
  if (!continueUrl) {
    return auth.generatePasswordResetLink(email);
  }

  try {
    const firebaseLink = await auth.generatePasswordResetLink(email, { url: continueUrl });
    return appInviteSetupLink(firebaseLink, email);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/unauthorized-continue-uri") {
      console.warn("APP_BASE_URL is not authorized in Firebase Authentication; generated invite link without continue URL.");
      return auth.generatePasswordResetLink(email);
    }

    throw error;
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
    const memberRef = db.doc(`organizations/${organizationId}/members/${user.uid}`);
    const previous = await memberRef.get();
    assertCanManageTargetMember(actor, previous.data());

    await auth.updateUser(user.uid, { disabled: false, displayName });
    await auth.setCustomUserClaims(user.uid, { organizationId, role });
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
    const setupLink = await generateInviteLink(email);

    await writeAuditLog({
      action: previous.exists ? "member.updateInvite" : "member.invite",
      actorId: request.auth.uid,
      actorName: actor.displayName,
      branchId,
      entityId: user.uid,
      entityType: "member",
      newValue: { branchId, displayName, email, role, setupLinkGenerated: true, status: "active" },
      organizationId,
      previousValue: previous.exists ? previous.data() : null,
    });

    return {
      email,
      setupLink,
      uid: user.uid,
    };
  } catch (error) {
    throw inviteError(error);
  }
});

export const getEmailSmtpSettings = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const member = await getActiveMember(request.auth.uid, organizationId);
  const snapshot = await emailSettingsDoc(organizationId, request.auth.uid).get();
  return sanitizeEmailSettings(snapshot.data(), member);
});

export const saveEmailSmtpSettings = onCall(mailSettingsSecretOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const member = await getActiveMember(request.auth.uid, organizationId);
  const payload = parseEmailSettingsPayload(request.data);
  const ref = emailSettingsDoc(organizationId, request.auth.uid);
  const previous = await ref.get();
  const previousData = previous.data();
  const encryptedPassword = payload.password ? encryptSecret(payload.password) : previousData?.encryptedPassword;

  if (!encryptedPassword) {
    throw new HttpsError("failed-precondition", "Enter your SMTP password before saving email settings.");
  }

  await ref.set({
    enabled: payload.enabled,
    encryptedPassword,
    host: payload.host,
    organizationId,
    ownerId: request.auth.uid,
    port: payload.port,
    replyTo: payload.replyTo ?? "",
    secureMode: payload.secureMode,
    senderEmail: payload.senderEmail,
    senderName: payload.senderName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
    username: payload.username,
  }, { merge: true });

  await writeAuditLog({
    action: previous.exists ? "emailSettings.update" : "emailSettings.create",
    actorId: request.auth.uid,
    actorName: member.displayName,
    branchId: member.branchId,
    entityId: request.auth.uid,
    entityType: "mailSettings",
    newValue: {
      enabled: payload.enabled,
      host: payload.host,
      port: payload.port,
      secureMode: payload.secureMode,
      senderEmail: payload.senderEmail,
      username: payload.username,
    },
    organizationId,
    previousValue: previous.exists ? {
      enabled: previousData?.enabled,
      host: previousData?.host,
      port: previousData?.port,
      secureMode: previousData?.secureMode,
      senderEmail: previousData?.senderEmail,
      username: previousData?.username,
    } : null,
  });

  const next = await ref.get();
  return sanitizeEmailSettings(next.data(), member);
});

export const sendEmailSmtpTest = onCall(mailSettingsSecretOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const member = await getActiveMember(request.auth.uid, organizationId);
  const recipient = typeof request.data?.recipient === "string" && request.data.recipient.trim()
    ? requireEmail(request.data.recipient)
    : member.email;
  const snapshot = await emailSettingsDoc(organizationId, request.auth.uid).get();
  const settings = snapshot.data();
  if (!snapshot.exists || !settings) {
    throw new HttpsError("failed-precondition", "Save your SMTP settings before sending a test email.");
  }

  const transport = smtpTransport(settings);
  try {
    await transport.sendMail({
      from: formattedSender(settings),
      replyTo: settings.replyTo || settings.senderEmail,
      subject: "Beacon Operations CRM SMTP test",
      text: "This is a test email from your Beacon Operations CRM email settings.",
      to: recipient,
    });
  } catch (error) {
    throw smtpSendError(error, String(settings.host));
  }

  await writeAuditLog({
    action: "emailSettings.test",
    actorId: request.auth.uid,
    actorName: member.displayName,
    branchId: member.branchId,
    entityId: request.auth.uid,
    entityType: "mailSettings",
    newValue: { recipient },
    organizationId,
  });

  return { ok: true };
});

export const sendSalesJourneyEmail = onCall(mailSettingsSecretOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const payload = parseSalesJourneyEmailPayload(request.data);
  const member = await getActiveMember(request.auth.uid, payload.organizationId);
  if (!member.permissions.includes("activities.create")) {
    throw new HttpsError("permission-denied", "You do not have permission to send sales journey emails.");
  }

  const leadRef = db.doc(`organizations/${payload.organizationId}/leads/${payload.leadId}`);
  const leadSnapshot = await leadRef.get();
  const lead = leadSnapshot.data();
  if (!leadSnapshot.exists || !lead || lead.isDeleted === true) {
    throw new HttpsError("not-found", "Lead not found.");
  }

  if (!member.permissions.includes("leads.readAll") && lead.assignedTo && lead.assignedTo !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You do not have access to this lead.");
  }

  const recipient = payload.recipient ?? requireEmail(lead.email);
  const settings = await getUsableEmailSettings(payload.organizationId, request.auth.uid);
  const transport = smtpTransport(settings);

  try {
    await transport.sendMail({
      from: formattedSender(settings),
      replyTo: settings.replyTo || settings.senderEmail,
      subject: payload.subject,
      text: payload.body,
      to: recipient,
    });
  } catch (error) {
    throw smtpSendError(error, String(settings.host));
  }

  const activityRef = await db.collection(`organizations/${payload.organizationId}/activities`).add({
    body: payload.body,
    branchId: member.branchId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    isDeleted: false,
    organizationId: payload.organizationId,
    referenceNumber: `ACT-${Date.now()}`,
    relatedEntityId: payload.leadId,
    relatedEntityType: "lead",
    status: "completed",
    subject: payload.subject,
    type: "email",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });

  const leadUpdate: Record<string, unknown> = {
    lastContactAt: FieldValue.serverTimestamp(),
    organizationId: payload.organizationId,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  };
  if (lead.status === "new") {
    leadUpdate.status = "contacted";
    leadUpdate.stageHistory = [
      ...(Array.isArray(lead.stageHistory) ? lead.stageHistory : []),
      {
        at: new Date().toISOString(),
        from: "new",
        note: `Email sent: ${payload.subject}`,
        to: "contacted",
        userId: request.auth.uid,
      },
    ];
  }
  await leadRef.update(leadUpdate);

  await writeAuditLog({
    action: "lead.emailSend",
    actorId: request.auth.uid,
    actorName: member.displayName,
    branchId: member.branchId,
    entityId: payload.leadId,
    entityType: "lead",
    newValue: { activityId: activityRef.id, recipient, subject: payload.subject },
    organizationId: payload.organizationId,
  });

  return { activityId: activityRef.id, ok: true };
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
  assertCanManageTargetMember(actor, previous.data());

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
  assertCanManageTargetMember(actor, previous.data());

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
  assertCanManageTargetMember(actor, previous.data());

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
