import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";
import { syncTaskToGoogleCalendar } from "./google-calendar.js";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();
const callableOptions = { cors: true, invoker: "public" as const };
const mailSettingsSecretOptions = { ...callableOptions, secrets: ["MAIL_SETTINGS_ENCRYPTION_KEY"] };
const googleCalendarSecrets = ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY"];
const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

const emailSettingsAccessPermissions = [
  "leads.readAssigned",
  "leads.readAll",
  "clients.read",
  "deals.read",
  "properties.read",
  "units.read",
  "offerings.read",
  "tasks.read",
  "activities.read",
  "users.manage",
];

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
    "offerings.create",
    "offerings.read",
    "offerings.update",
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
  managingDirector: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "properties.read", "deals.read", "units.read", "rentals.read", "development.read", "marketing.read", "offerings.read", "tasks.read", "activities.read", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  operationsManager: ["dashboard.viewExecutive", "leads.create", "leads.readAll", "leads.assign", "clients.create", "clients.read", "clients.update", "deals.create", "deals.read", "deals.update", "properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "rentals.create", "rentals.read", "rentals.update", "development.create", "development.read", "development.update", "marketing.create", "marketing.read", "marketing.update", "offerings.create", "offerings.read", "offerings.update", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read", "users.manage"],
  salesManager: ["leads.create", "leads.readAll", "leads.updateAssigned", "leads.assign", "clients.create", "clients.read", "clients.update", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "marketing.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  salesExecutive: ["leads.create", "leads.readAssigned", "leads.updateAssigned", "clients.create", "clients.read", "deals.create", "deals.read", "deals.update", "properties.read", "units.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  propertyManager: ["properties.create", "properties.read", "properties.update", "units.create", "units.read", "units.update", "offerings.read", "deals.read", "rentals.create", "rentals.read", "rentals.update", "development.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  financeManager: ["clients.read", "properties.read", "units.read", "deals.read", "rentals.read", "rentals.update", "offerings.read", "activities.create", "activities.read", "finance.create", "finance.update", "finance.approve", "reports.viewFinancial", "auditLogs.read"],
  accountant: ["clients.read", "properties.read", "deals.read", "rentals.read", "rentals.update", "offerings.read", "activities.create", "activities.read", "finance.create", "finance.update", "reports.viewFinancial"],
  legalOfficer: ["clients.read", "properties.read", "deals.read", "rentals.read", "offerings.read", "auditLogs.read"],
  projectManager: ["properties.read", "properties.update", "development.create", "development.read", "development.update", "offerings.read", "tasks.create", "tasks.read", "tasks.update", "activities.create", "activities.read"],
  marketingOfficer: ["leads.create", "leads.readAll", "properties.read", "marketing.create", "marketing.read", "marketing.update", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  customerServiceOfficer: ["leads.create", "leads.readAssigned", "clients.read", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  frontDeskOfficer: ["leads.create", "leads.readAssigned", "offerings.read", "tasks.create", "tasks.read", "activities.create", "activities.read"],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: ["dashboard.viewExecutive", "leads.readAll", "clients.read", "deals.read", "properties.read", "units.read", "rentals.read", "development.read", "marketing.read", "offerings.read", "tasks.read", "activities.read", "reports.viewFinancial", "auditLogs.read"],
} as const;

type RoleName = keyof typeof rolePermissions;
type BranchAccess = "own" | "all";

interface ActorContext {
  branchId: string;
  branchAccess: BranchAccess;
  displayName: string;
  email: string;
  id: string;
  permissions: string[];
  role: string;
  roles: RoleName[];
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

interface BulkEmailPayload {
  body: string;
  organizationId: string;
  recipientIds: string[];
  recipientType: "client" | "lead";
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

function requireRoles(value: unknown, fallback: unknown) {
  const source = Array.isArray(value) && value.length ? value : [fallback];
  const roles = Array.from(new Set(source.map((item) => requireRole(item))));
  if (!roles.length) {
    throw new HttpsError("invalid-argument", "Select at least one role.");
  }

  return roles;
}

function requireBranchAccess(value: unknown) {
  return value === "all" ? "all" : "own";
}

function permissionsForRoles(roles: RoleName[]) {
  return Array.from(new Set(roles.flatMap((role) => rolePermissions[role])));
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

  console.error("SMTP send failed", { code, command, host, responseCode });

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
  const memberRoles = Array.isArray(data?.roles)
    ? data.roles.filter((role): role is RoleName => typeof role === "string" && role in rolePermissions)
    : [];
  const permissions = Array.isArray(data?.permissions) ? data.permissions as string[] : [];
  return Boolean(memberRole && isPrivilegedRole(memberRole)) ||
    memberRoles.some((role) => isPrivilegedRole(role)) ||
    permissions.some((permission) => ["users.manage", "roles.manage"].includes(permission));
}

async function getActor(uid: string, organizationId: string): Promise<ActorContext> {
  const actor = await getActiveMember(uid, organizationId);

  if (!hasActorPermission(actor, "users.manage")) {
    throw new HttpsError("permission-denied", "You do not have permission to manage organization members.");
  }

  return actor;
}

async function getActiveMember(uid: string, organizationId: string): Promise<ActorContext> {
  const member = await db.doc(`organizations/${organizationId}/members/${uid}`).get();
  const data = member.data();
  const permissions = Array.isArray(data?.permissions) ? data.permissions as string[] : [];
  const primaryRole = typeof data?.role === "string" && data.role in rolePermissions ? data.role as RoleName : null;
  const storedRoles = Array.isArray(data?.roles)
    ? data.roles.filter((role): role is RoleName => typeof role === "string" && role in rolePermissions)
    : [];
  const roles = Array.from(new Set([...storedRoles, primaryRole].filter((role): role is RoleName => Boolean(role))));

  if (!member.exists || data?.status !== "active") {
    throw new HttpsError("permission-denied", "You do not have access to this organization.");
  }

  return {
    branchId: typeof data?.branchId === "string" ? data.branchId : "",
    branchAccess: data?.branchAccess === "all" ? "all" : "own",
    displayName: typeof data?.displayName === "string" ? data.displayName : uid,
    email: typeof data?.email === "string" ? data.email : "",
    id: uid,
    permissions,
    role: primaryRole ?? "unknown",
    roles,
  };
}

function assertCanAssignRole(actor: ActorContext, role: RoleName) {
  if (isPrivilegedRole(role) && !hasActorPermission(actor, "roles.manage")) {
    throw new HttpsError("permission-denied", "You cannot assign privileged roles.");
  }
}

function assertCanAssignRoles(actor: ActorContext, roles: RoleName[]) {
  roles.forEach((role) => assertCanAssignRole(actor, role));
}

function assertCanGrantBranchAccess(actor: ActorContext, branchAccess: BranchAccess) {
  if (branchAccess === "all" && !hasActorPermission(actor, "roles.manage")) {
    throw new HttpsError("permission-denied", "Only super admins can grant all-branch access.");
  }
}

function assertCanManageTargetMember(actor: ActorContext, target: DocumentData | undefined) {
  if (isPrivilegedMember(target) && !hasActorPermission(actor, "roles.manage")) {
    throw new HttpsError("permission-denied", "You cannot manage privileged users.");
  }
}

function assertCanUseEmailSettings(member: ActorContext) {
  if (!hasAnyActorPermission(member, emailSettingsAccessPermissions)) {
    throw new HttpsError("permission-denied", "You do not have permission to manage email settings.");
  }
}

function hasActorRole(member: ActorContext, role: RoleName) {
  return member.roles.includes(role);
}

function hasActorPermission(member: ActorContext, permission: string) {
  return hasActorRole(member, "superAdmin") || member.permissions.includes(permission);
}

function hasAnyActorPermission(member: ActorContext, permissions: readonly string[]) {
  return hasActorRole(member, "superAdmin") || permissions.some((permission) => member.permissions.includes(permission));
}

function canActorAccessBranch(member: ActorContext, branchId: unknown) {
  return hasActorRole(member, "superAdmin") || member.branchAccess === "all" || branchId === member.branchId;
}

function isAssignedOnlySalesActor(member: ActorContext) {
  return hasActorRole(member, "salesExecutive") &&
    !member.roles.some((role) => ["superAdmin", "managingDirector", "operationsManager", "salesManager"].includes(role));
}

function assertCanAccessRecordBranch(member: ActorContext, record: DocumentData) {
  if (!canActorAccessBranch(member, record.branchId)) {
    throw new HttpsError("permission-denied", "You do not have access to records from this branch.");
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

function parseBulkEmailPayload(data: unknown): BulkEmailPayload {
  const record = typeof data === "object" && data ? data as Record<string, unknown> : {};
  const recipientType = record.recipientType === "client" ? "client" : record.recipientType === "lead" ? "lead" : null;
  const recipientIds = Array.isArray(record.recipientIds)
    ? Array.from(new Set(record.recipientIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim())))
    : [];

  if (!recipientType) {
    throw new HttpsError("invalid-argument", "recipientType must be lead or client.");
  }

  if (!recipientIds.length) {
    throw new HttpsError("invalid-argument", "Select at least one recipient.");
  }

  if (recipientIds.length > 50) {
    throw new HttpsError("invalid-argument", "Send bulk email to 50 recipients or fewer at a time.");
  }

  return {
    body: requireString(record.body, "body"),
    organizationId: requireString(record.organizationId, "organizationId"),
    recipientIds,
    recipientType,
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

function ensureCanReadBulkRecipient(member: ActorContext, recipientType: BulkEmailPayload["recipientType"], record: DocumentData) {
  assertCanAccessRecordBranch(member, record);

  if (recipientType === "client") {
    if (!hasActorPermission(member, "clients.read")) {
      throw new HttpsError("permission-denied", "You do not have permission to email clients.");
    }
    if (isAssignedOnlySalesActor(member) && record.assignedRelationshipManager !== member.id && record.assignedTo !== member.id) {
      throw new HttpsError("permission-denied", "You can only bulk email assigned clients.");
    }
    return;
  }

  if (!hasActorPermission(member, "leads.readAll") && record.assignedTo !== member.id) {
    throw new HttpsError("permission-denied", "You can only bulk email assigned leads.");
  }

  if (!hasActorPermission(member, "leads.readAll") && !hasActorPermission(member, "leads.readAssigned")) {
    throw new HttpsError("permission-denied", "You do not have permission to email leads.");
  }
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

function normalizedAppBaseUrl(origin?: string) {
  const candidate = appBaseUrl || origin || "";
  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function inviteUrl(origin?: string) {
  const baseUrl = normalizedAppBaseUrl(origin);
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl}/invite/setup`;
}

function appInviteSetupLink(firebaseLink: string, email: string, origin?: string) {
  const setupUrl = inviteUrl(origin);
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

async function generateInviteLinkForOrigin(email: string, origin?: string) {
  const continueUrl = inviteUrl(origin);
  if (!continueUrl) {
    return auth.generatePasswordResetLink(email);
  }

  try {
    const firebaseLink = await auth.generatePasswordResetLink(email, { url: continueUrl });
    return appInviteSetupLink(firebaseLink, email, origin);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/unauthorized-continue-uri") {
      console.warn("Invite continue URL is not authorized in Firebase Authentication; generated a setup link from the default Firebase action code.");
      const firebaseLink = await auth.generatePasswordResetLink(email);
      return appInviteSetupLink(firebaseLink, email, origin);
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
    const branchAccess = requireBranchAccess(request.data?.branchAccess);
    const displayName = requireString(request.data?.displayName, "displayName");
    const email = requireEmail(request.data?.email);
    const roles = requireRoles(request.data?.roles, request.data?.role);
    const role = roles[0];
    const phoneNumber = typeof request.data?.phoneNumber === "string" ? request.data.phoneNumber.trim() : "";
    const actor = await getActor(request.auth.uid, organizationId);
    assertCanAssignRoles(actor, roles);
    assertCanGrantBranchAccess(actor, branchAccess);

    const user = await getOrCreateUser(email, displayName);
    const memberRef = db.doc(`organizations/${organizationId}/members/${user.uid}`);
    const previous = await memberRef.get();
    assertCanManageTargetMember(actor, previous.data());

    await auth.updateUser(user.uid, { disabled: false, displayName });
    await auth.setCustomUserClaims(user.uid, { organizationId, role, roles });
    const payload = {
      branchId,
      branchAccess,
      createdAt: previous.exists ? previous.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      createdBy: previous.exists ? previous.data()?.createdBy ?? request.auth.uid : request.auth.uid,
      displayName,
      email,
      organizationId,
      permissions: permissionsForRoles(roles),
      phoneNumber,
      role,
      roles,
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };

    await memberRef.set(payload, { merge: true });
    const origin = typeof request.rawRequest.headers.origin === "string" ? request.rawRequest.headers.origin : undefined;
    const setupLink = await generateInviteLinkForOrigin(email, origin);

    await writeAuditLog({
      action: previous.exists ? "member.updateInvite" : "member.invite",
      actorId: request.auth.uid,
      actorName: actor.displayName,
      branchId,
      entityId: user.uid,
      entityType: "member",
      newValue: { branchAccess, branchId, displayName, email, role, roles, setupLinkGenerated: true, status: "active" },
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

export const resendOrganizationMemberInvite = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  try {
    const organizationId = requireString(request.data?.organizationId, "organizationId");
    const uid = requireString(request.data?.uid, "uid");
    const actor = await getActor(request.auth.uid, organizationId);
    const memberRef = db.doc(`organizations/${organizationId}/members/${uid}`);
    const memberSnapshot = await memberRef.get();
    const target = memberSnapshot.data();

    if (!memberSnapshot.exists || !target) {
      throw new HttpsError("not-found", "This organization member was not found.");
    }

    assertCanManageTargetMember(actor, target);

    if (target.status === "disabled") {
      throw new HttpsError("failed-precondition", "Reactivate this user before generating a setup link.");
    }

    const userRecord = await auth.getUser(uid);
    const email = requireEmail(userRecord.email ?? target.email);
    const origin = typeof request.rawRequest.headers.origin === "string" ? request.rawRequest.headers.origin : undefined;
    const setupLink = await generateInviteLinkForOrigin(email, origin);

    await writeAuditLog({
      action: "member.resendInvite",
      actorId: request.auth.uid,
      actorName: actor.displayName,
      branchId: typeof target.branchId === "string" ? target.branchId : actor.branchId,
      entityId: uid,
      entityType: "member",
      newValue: { email, setupLinkGenerated: true },
      organizationId,
      previousValue: target,
    });

    return {
      email,
      setupLink,
      uid,
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
  assertCanUseEmailSettings(member);
  const snapshot = await emailSettingsDoc(organizationId, request.auth.uid).get();
  return sanitizeEmailSettings(snapshot.data(), member);
});

export const saveEmailSmtpSettings = onCall(mailSettingsSecretOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const member = await getActiveMember(request.auth.uid, organizationId);
  assertCanUseEmailSettings(member);
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
  assertCanUseEmailSettings(member);
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
  if (!hasActorPermission(member, "activities.create")) {
    throw new HttpsError("permission-denied", "You do not have permission to send sales journey emails.");
  }

  const leadRef = db.doc(`organizations/${payload.organizationId}/leads/${payload.leadId}`);
  const leadSnapshot = await leadRef.get();
  const lead = leadSnapshot.data();
  if (!leadSnapshot.exists || !lead || lead.isDeleted === true) {
    throw new HttpsError("not-found", "Lead not found.");
  }

  assertCanAccessRecordBranch(member, lead);

  if (!hasActorPermission(member, "leads.readAll") && lead.assignedTo && lead.assignedTo !== request.auth.uid) {
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

export const sendBulkSalesEmail = onCall(mailSettingsSecretOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const actorId = request.auth.uid;
  const payload = parseBulkEmailPayload(request.data);
  const member = await getActiveMember(actorId, payload.organizationId);
  if (!hasActorPermission(member, "activities.create")) {
    throw new HttpsError("permission-denied", "You do not have permission to send sales emails.");
  }

  if (payload.recipientType === "client" && !hasActorPermission(member, "clients.read")) {
    throw new HttpsError("permission-denied", "You do not have permission to email clients.");
  }

  if (payload.recipientType === "lead" && !hasActorPermission(member, "leads.readAll") && !hasActorPermission(member, "leads.readAssigned")) {
    throw new HttpsError("permission-denied", "You do not have permission to email leads.");
  }

  const settings = await getUsableEmailSettings(payload.organizationId, actorId);
  const transport = smtpTransport(settings);
  const collectionName = payload.recipientType === "lead" ? "leads" : "clients";
  const refs = payload.recipientIds.map((id) => db.doc(`organizations/${payload.organizationId}/${collectionName}/${id}`));
  const snapshots = await db.getAll(...refs);
  const sent: Array<{ email: string; id: string; name: string }> = [];
  const failed: Array<{ id: string; name: string; reason: string }> = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const snapshot of snapshots) {
    const record = snapshot.data();
    const name = String(record?.fullName ?? record?.companyName ?? record?.name ?? record?.referenceNumber ?? snapshot.id);
    if (!snapshot.exists || !record || record.isDeleted === true) {
      skipped.push({ id: snapshot.id, name, reason: "Record not found." });
      continue;
    }

    ensureCanReadBulkRecipient(member, payload.recipientType, record);

    if (typeof record.email !== "string" || !record.email.trim()) {
      skipped.push({ id: snapshot.id, name, reason: "No email address." });
      continue;
    }

    let email = "";
    try {
      email = requireEmail(record.email);
    } catch {
      skipped.push({ id: snapshot.id, name, reason: "Invalid email address." });
      continue;
    }

    try {
      await transport.sendMail({
        from: formattedSender(settings),
        replyTo: settings.replyTo || settings.senderEmail,
        subject: payload.subject,
        text: payload.body,
        to: email,
      });
      sent.push({ email, id: snapshot.id, name });
    } catch (error) {
      const nextError = smtpSendError(error, String(settings.host));
      failed.push({ id: snapshot.id, name, reason: nextError.message });
    }
  }

  if (sent.length) {
    const batch = db.batch();
    sent.forEach((recipient, index) => {
      const activityRef = db.collection(`organizations/${payload.organizationId}/activities`).doc();
      batch.set(activityRef, {
        body: payload.body,
        branchId: member.branchId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actorId,
        isDeleted: false,
        organizationId: payload.organizationId,
        referenceNumber: `ACT-${Date.now()}-${index + 1}`,
        relatedEntityId: recipient.id,
        relatedEntityType: payload.recipientType,
        status: "completed",
        subject: payload.subject,
        type: "email",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorId,
      });

      const recipientRef = db.doc(`organizations/${payload.organizationId}/${collectionName}/${recipient.id}`);
      const updatePayload: Record<string, unknown> = {
        lastContactAt: FieldValue.serverTimestamp(),
        organizationId: payload.organizationId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorId,
      };
      if (payload.recipientType === "lead") {
        const snapshot = snapshots.find((item) => item.id === recipient.id);
        const record = snapshot?.data();
        if (record?.status === "new") {
          updatePayload.status = "contacted";
          updatePayload.stageHistory = [
            ...(Array.isArray(record.stageHistory) ? record.stageHistory : []),
            {
              at: new Date().toISOString(),
              from: "new",
              note: `Bulk email sent: ${payload.subject}`,
              to: "contacted",
              userId: actorId,
            },
          ];
        }
      }
      batch.update(recipientRef, updatePayload);
    });

    await batch.commit();
  }

  await writeAuditLog({
    action: `${payload.recipientType}.bulkEmailSend`,
    actorId,
    actorName: member.displayName,
    branchId: member.branchId,
    entityId: payload.recipientType,
    entityType: payload.recipientType,
    newValue: {
      failedCount: failed.length,
      recipientIds: sent.map((recipient) => recipient.id),
      sentCount: sent.length,
      skippedCount: skipped.length,
      subject: payload.subject,
    },
    organizationId: payload.organizationId,
  });

  return {
    failed,
    ok: failed.length === 0,
    sent,
    skipped,
  };
});

export const updateOrganizationMemberRole = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const branchId = requireString(request.data?.branchId, "branchId");
  const branchAccess = requireBranchAccess(request.data?.branchAccess);
  const targetUid = requireString(request.data?.uid, "uid");
  const roles = requireRoles(request.data?.roles, request.data?.role);
  const role = roles[0];
  const actor = await getActor(request.auth.uid, organizationId);
  assertCanAssignRoles(actor, roles);
  assertCanGrantBranchAccess(actor, branchAccess);

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
    branchAccess,
    permissions: permissionsForRoles(roles),
    role,
    roles,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });
  await auth.setCustomUserClaims(targetUid, { organizationId, role, roles });
  await writeAuditLog({
    action: "member.roleBranchUpdate",
    actorId: request.auth.uid,
    actorName: actor.displayName,
    branchId,
    entityId: targetUid,
    entityType: "member",
    newValue: { branchAccess, branchId, role, roles },
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
  const actorName = String(memberData?.displayName ?? request.auth.token.email ?? request.auth.uid);
  const actorEmail = String(memberData?.email ?? request.auth.token.email ?? "");
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
      assignedRelationshipManager: data?.assignedTo ?? request.auth?.uid,
      assignedTo: data?.assignedTo ?? request.auth?.uid,
      branchId: data?.branchId,
      category: "buyer",
      clientType: "individual",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth?.uid,
      createdByEmail: actorEmail,
      createdByName: actorName,
      email: data?.email ?? "",
      fullName: data?.fullName,
      isDeleted: false,
      organizationId,
      phoneNumber: data?.phoneNumber,
      referenceNumber: `CLIENT-${Date.now()}`,
      sourceLeadId: leadId,
      status: "active",
      tags: data?.tags ?? [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid,
      updatedByEmail: actorEmail,
      updatedByName: actorName,
    });
    transaction.update(leadRef, {
      clientId: clientRef.id,
      convertedAt: FieldValue.serverTimestamp(),
      convertedBy: request.auth?.uid,
      convertedByEmail: actorEmail,
      convertedByName: actorName,
      lastContactAt: FieldValue.serverTimestamp(),
      stageHistory: [
        ...stageHistory,
        {
          at: new Date().toISOString(),
          from: data?.status ?? "new",
          note: "Lead converted to client after confirmed commitment.",
          to: "converted",
          userEmail: actorEmail,
          userId: request.auth?.uid,
          userName: actorName,
        },
      ],
      status: "converted",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid,
      updatedByEmail: actorEmail,
      updatedByName: actorName,
    });
  });

  await db.collection(`organizations/${organizationId}/activities`).add({
    body: `Client record created from lead ${leadId}.`,
    branchId: convertedLead?.branchId ?? memberData?.branchId ?? "",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    createdByEmail: actorEmail,
    createdByName: actorName,
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
    updatedByEmail: actorEmail,
    updatedByName: actorName,
  });

  await writeAuditLog({
    action: "lead.convert",
    actorId: request.auth.uid,
    actorName,
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

const stalePushTokenCodes = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function pushText(value: unknown, fallback: string, maximumLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maximumLength);
}

function pushHref(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/notifications";
}

export const deliverNotificationPush = onDocumentCreated(
  "organizations/{organizationId}/notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    const organizationId = event.params.organizationId;
    const notificationId = event.params.notificationId;
    const recipientId = typeof notification?.recipientId === "string" ? notification.recipientId : "";
    if (!notification || !recipientId || notification.isDeleted === true) {
      return;
    }

    const subscriptionSnapshot = await db.collection(`organizations/${organizationId}/pushSubscriptions`)
      .where("userId", "==", recipientId)
      .where("status", "==", "active")
      .get();
    const subscriptions = subscriptionSnapshot.docs.filter((item) => {
      const data = item.data();
      return data.isDeleted === false && typeof data.token === "string" && data.token.length > 20;
    });
    if (!subscriptions.length) {
      return;
    }

    const data = {
      body: pushText(notification.body, "You have a new CRM notification.", 240),
      dedupeKey: pushText(notification.dedupeKey, notificationId, 180),
      href: pushHref(notification.href),
      notificationId,
      organizationId,
      title: pushText(notification.title, "Vlingo CRM", 100),
    };

    for (let index = 0; index < subscriptions.length; index += 500) {
      const batch = subscriptions.slice(index, index + 500);
      const response = await messaging.sendEachForMulticast({
        data,
        tokens: batch.map((item) => String(item.data().token)),
        webpush: {
          headers: { Urgency: notification.tone === "danger" ? "high" : "normal" },
        },
      });

      const staleSubscriptions = response.responses.flatMap((result, resultIndex) => {
        if (!result.success && result.error?.code && stalePushTokenCodes.has(result.error.code)) {
          return [batch[resultIndex].ref.delete()];
        }
        return [];
      });
      await Promise.all(staleSubscriptions);
    }
  },
);

export const syncTaskGoogleCalendar = onDocumentWritten(
  {
    document: "organizations/{organizationId}/tasks/{taskId}",
    secrets: googleCalendarSecrets,
  },
  async (event) => {
    try {
      await syncTaskToGoogleCalendar(
        event.params.organizationId,
        event.params.taskId,
        event.data?.before.exists ? event.data.before.data() : undefined,
        event.data?.after.exists ? event.data.after.data() : undefined,
      );
    } catch (error) {
      console.error("[Google Calendar task sync failed]", {
        error,
        organizationId: event.params.organizationId,
        taskId: event.params.taskId,
      });
    }
  },
);
