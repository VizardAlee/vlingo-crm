import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
} from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";
import { syncTaskToGoogleCalendar } from "./google-calendar.js";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();
const callableOptions = { cors: true, invoker: "public" as const };
const mailSettingsSecretOptions = {
  ...callableOptions,
  secrets: ["MAIL_SETTINGS_ENCRYPTION_KEY"],
};
const googleCalendarSecrets = [
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
];
const appBaseUrl =
  process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

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
    "installations.create",
    "installations.read",
    "installations.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "inventory.read",
    "inventory.manageCatalog",
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.procure",
    "inventory.approve",
    "inventory.count",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
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
  managingDirector: [
    "dashboard.viewExecutive",
    "leads.readAll",
    "clients.read",
    "properties.read",
    "deals.read",
    "units.read",
    "rentals.read",
    "development.read",
    "installations.read",
    "marketing.read",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.approve",
    "pos.read",
    "tasks.read",
    "activities.read",
    "finance.approve",
    "reports.viewFinancial",
    "auditLogs.read",
  ],
  operationsManager: [
    "dashboard.viewExecutive",
    "leads.create",
    "leads.readAll",
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
    "units.create",
    "units.read",
    "units.update",
    "rentals.create",
    "rentals.read",
    "rentals.update",
    "development.create",
    "development.read",
    "development.update",
    "installations.create",
    "installations.read",
    "installations.update",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "inventory.read",
    "inventory.manageCatalog",
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.procure",
    "inventory.approve",
    "inventory.count",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
    "users.manage",
  ],
  salesManager: [
    "leads.create",
    "leads.readAll",
    "leads.updateAssigned",
    "leads.assign",
    "clients.create",
    "clients.read",
    "clients.update",
    "deals.create",
    "deals.read",
    "deals.update",
    "installations.create",
    "installations.read",
    "properties.read",
    "units.read",
    "marketing.read",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  salesExecutive: [
    "leads.create",
    "leads.readAssigned",
    "leads.updateAssigned",
    "clients.create",
    "clients.read",
    "deals.create",
    "deals.read",
    "deals.update",
    "installations.create",
    "installations.read",
    "properties.read",
    "units.read",
    "offerings.read",
    "inventory.read",
    "inventory.reserve",
    "pos.read",
    "pos.sell",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  propertyManager: [
    "properties.create",
    "properties.read",
    "properties.update",
    "units.create",
    "units.read",
    "units.update",
    "offerings.read",
    "deals.read",
    "rentals.create",
    "rentals.read",
    "rentals.update",
    "development.read",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  financeManager: [
    "clients.read",
    "properties.read",
    "units.read",
    "deals.read",
    "installations.read",
    "rentals.read",
    "rentals.update",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.approve",
    "pos.read",
    "activities.create",
    "activities.read",
    "finance.create",
    "finance.update",
    "finance.approve",
    "reports.viewFinancial",
    "auditLogs.read",
  ],
  accountant: [
    "clients.read",
    "properties.read",
    "deals.read",
    "installations.read",
    "rentals.read",
    "rentals.update",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "pos.read",
    "activities.create",
    "activities.read",
    "finance.create",
    "finance.update",
    "reports.viewFinancial",
  ],
  legalOfficer: [
    "clients.read",
    "properties.read",
    "deals.read",
    "rentals.read",
    "offerings.read",
    "auditLogs.read",
  ],
  projectManager: [
    "properties.read",
    "properties.update",
    "development.create",
    "development.read",
    "development.update",
    "installations.create",
    "installations.read",
    "installations.update",
    "offerings.read",
    "inventory.read",
    "inventory.issue",
    "inventory.reserve",
    "inventory.procure",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
  ],
  marketingOfficer: [
    "leads.create",
    "leads.readAll",
    "properties.read",
    "marketing.create",
    "marketing.read",
    "marketing.update",
    "offerings.read",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  customerServiceOfficer: [
    "leads.create",
    "leads.readAssigned",
    "clients.read",
    "offerings.read",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  frontDeskOfficer: [
    "leads.create",
    "leads.readAssigned",
    "offerings.read",
    "inventory.read",
    "pos.read",
    "pos.sell",
    "tasks.create",
    "tasks.read",
    "activities.create",
    "activities.read",
  ],
  agent: ["leads.readAssigned", "activities.create", "activities.read"],
  auditor: [
    "dashboard.viewExecutive",
    "leads.readAll",
    "clients.read",
    "deals.read",
    "installations.read",
    "properties.read",
    "units.read",
    "rentals.read",
    "development.read",
    "marketing.read",
    "offerings.read",
    "inventory.read",
    "inventory.viewReports",
    "pos.read",
    "tasks.read",
    "activities.read",
    "reports.viewFinancial",
    "auditLogs.read",
  ],
  inventoryManager: [
    "installations.read",
    "offerings.create",
    "offerings.read",
    "offerings.update",
    "inventory.read",
    "inventory.manageCatalog",
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.viewReports",
    "inventory.comment",
    "inventory.procure",
    "inventory.count",
    "inventory.reserve",
    "pos.read",
    "tasks.create",
    "tasks.read",
    "tasks.update",
    "activities.create",
    "activities.read",
  ],
  brandPartner: [
    "inventory.read",
    "inventory.viewReports",
    "inventory.comment",
  ],
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

async function requirePartnerBrandIds(
  organizationId: string,
  roles: RoleName[],
  value: unknown,
) {
  const isPartner = roles.includes("brandPartner");
  if (isPartner && roles.length !== 1) {
    throw new HttpsError(
      "invalid-argument",
      "Brand partner cannot be combined with an internal role.",
    );
  }
  if (!isPartner) return [];
  const ids = Array.from(
    new Set(
      Array.isArray(value)
        ? value
            .filter(
              (item): item is string =>
                typeof item === "string" && Boolean(item.trim()),
            )
            .map((item) => item.trim())
        : [],
    ),
  );
  if (!ids.length)
    throw new HttpsError(
      "invalid-argument",
      "Select at least one brand for a brand partner.",
    );
  const snapshots = await db.getAll(
    ...ids.map((id) =>
      db.doc(`organizations/${organizationId}/inventoryBrands/${id}`),
    ),
  );
  if (
    snapshots.some(
      (snapshot) => !snapshot.exists || snapshot.data()?.status !== "active",
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Every partner brand must exist and be active.",
    );
  }
  return ids;
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
    throw new HttpsError(
      "invalid-argument",
      "secureMode must be none, ssl, or starttls.",
    );
  }

  return mode as EmailSettingsPayload["secureMode"];
}

function smtpSendError(error: unknown, host: string) {
  const record =
    typeof error === "object" && error
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof record.code === "string" ? record.code : "";
  const command = typeof record.command === "string" ? record.command : "";
  const response = typeof record.response === "string" ? record.response : "";
  const responseCode =
    typeof record.responseCode === "number" ? record.responseCode : undefined;

  console.error("SMTP send failed", { code, command, host, responseCode });

  if (["EDNS", "ENOTFOUND"].includes(code)) {
    return new HttpsError(
      "failed-precondition",
      `SMTP host "${host}" could not be found. Check the spelling. For Google Workspace, use smtp.gmail.com.`,
    );
  }

  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED"].includes(code)) {
    return new HttpsError(
      "failed-precondition",
      `Unable to connect to ${host}. Check the SMTP host, port, security mode, and whether your provider allows SMTP connections.`,
    );
  }

  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return new HttpsError(
      "failed-precondition",
      "SMTP authentication failed. Check the username and password. Google Workspace, Gmail, Microsoft 365, and Outlook may require an app password or SMTP auth to be enabled.",
    );
  }

  if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) {
    return new HttpsError(
      "failed-precondition",
      "The SMTP provider rejected the sender or recipient address. Check the sender email, reply-to email, and test recipient.",
    );
  }

  return new HttpsError(
    "internal",
    response ||
      "Unable to send test email. Check the SMTP settings and provider logs.",
  );
}

function isPrivilegedRole(role: RoleName) {
  return (
    role === "superAdmin" ||
    role === "managingDirector" ||
    rolePermissions[role].some((permission) =>
      ["users.manage", "roles.manage"].includes(permission),
    )
  );
}

function isPrivilegedMember(data: DocumentData | undefined) {
  const memberRole =
    typeof data?.role === "string" && data.role in rolePermissions
      ? (data.role as RoleName)
      : null;
  const memberRoles = Array.isArray(data?.roles)
    ? data.roles.filter(
        (role): role is RoleName =>
          typeof role === "string" && role in rolePermissions,
      )
    : [];
  const permissions = Array.isArray(data?.permissions)
    ? (data.permissions as string[])
    : [];
  return (
    Boolean(memberRole && isPrivilegedRole(memberRole)) ||
    memberRoles.some((role) => isPrivilegedRole(role)) ||
    permissions.some((permission) =>
      ["users.manage", "roles.manage"].includes(permission),
    )
  );
}

async function getActor(
  uid: string,
  organizationId: string,
): Promise<ActorContext> {
  const actor = await getActiveMember(uid, organizationId);

  if (!hasActorPermission(actor, "users.manage")) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to manage organization members.",
    );
  }

  return actor;
}

async function getActiveMember(
  uid: string,
  organizationId: string,
): Promise<ActorContext> {
  const member = await db
    .doc(`organizations/${organizationId}/members/${uid}`)
    .get();
  const data = member.data();
  const permissions = Array.isArray(data?.permissions)
    ? (data.permissions as string[])
    : [];
  const primaryRole =
    typeof data?.role === "string" && data.role in rolePermissions
      ? (data.role as RoleName)
      : null;
  const storedRoles = Array.isArray(data?.roles)
    ? data.roles.filter(
        (role): role is RoleName =>
          typeof role === "string" && role in rolePermissions,
      )
    : [];
  const roles = Array.from(
    new Set(
      [...storedRoles, primaryRole].filter((role): role is RoleName =>
        Boolean(role),
      ),
    ),
  );

  if (!member.exists || data?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "You do not have access to this organization.",
    );
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
    throw new HttpsError(
      "permission-denied",
      "You cannot assign privileged roles.",
    );
  }
}

function assertCanAssignRoles(actor: ActorContext, roles: RoleName[]) {
  roles.forEach((role) => assertCanAssignRole(actor, role));
}

function assertCanGrantBranchAccess(
  actor: ActorContext,
  branchAccess: BranchAccess,
) {
  if (branchAccess === "all" && !hasActorPermission(actor, "roles.manage")) {
    throw new HttpsError(
      "permission-denied",
      "Only super admins can grant all-branch access.",
    );
  }
}

function assertCanManageTargetMember(
  actor: ActorContext,
  target: DocumentData | undefined,
) {
  if (
    isPrivilegedMember(target) &&
    !hasActorPermission(actor, "roles.manage")
  ) {
    throw new HttpsError(
      "permission-denied",
      "You cannot manage privileged users.",
    );
  }
}

function assertCanUseEmailSettings(member: ActorContext) {
  if (!hasAnyActorPermission(member, emailSettingsAccessPermissions)) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to manage email settings.",
    );
  }
}

function hasActorRole(member: ActorContext, role: RoleName) {
  return member.roles.includes(role);
}

function hasActorPermission(member: ActorContext, permission: string) {
  return (
    hasActorRole(member, "superAdmin") ||
    member.permissions.includes(permission)
  );
}

function hasAnyActorPermission(
  member: ActorContext,
  permissions: readonly string[],
) {
  return (
    hasActorRole(member, "superAdmin") ||
    permissions.some((permission) => member.permissions.includes(permission))
  );
}

function canActorAccessBranch(member: ActorContext, branchId: unknown) {
  return (
    hasActorRole(member, "superAdmin") ||
    member.branchAccess === "all" ||
    branchId === member.branchId
  );
}

function isAssignedOnlySalesActor(member: ActorContext) {
  return (
    hasActorRole(member, "salesExecutive") &&
    !member.roles.some((role) =>
      [
        "superAdmin",
        "managingDirector",
        "operationsManager",
        "salesManager",
      ].includes(role),
    )
  );
}

function assertCanAccessRecordBranch(
  member: ActorContext,
  record: DocumentData,
) {
  if (!canActorAccessBranch(member, record.branchId)) {
    throw new HttpsError(
      "permission-denied",
      "You do not have access to records from this branch.",
    );
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
    throw new HttpsError(
      "failed-precondition",
      "MAIL_SETTINGS_ENCRYPTION_KEY must be configured with at least 32 characters.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new HttpsError(
      "failed-precondition",
      "Saved SMTP password is not readable.",
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseEmailSettingsPayload(data: unknown): EmailSettingsPayload {
  const record =
    typeof data === "object" && data ? (data as Record<string, unknown>) : {};
  const port = requireNumber(record.port, "port");
  if (port < 1 || port > 65535) {
    throw new HttpsError(
      "invalid-argument",
      "port must be between 1 and 65535.",
    );
  }
  const host = requireString(record.host, "host").toLowerCase();
  if (host === "stmp.gmail.com") {
    throw new HttpsError(
      "invalid-argument",
      "Use smtp.gmail.com, not stmp.gmail.com.",
    );
  }

  return {
    enabled: record.enabled === true,
    host,
    password:
      typeof record.password === "string" && record.password
        ? record.password
        : undefined,
    port,
    replyTo:
      typeof record.replyTo === "string" && record.replyTo.trim()
        ? requireEmail(record.replyTo)
        : undefined,
    secureMode: requireSecureMode(record.secureMode),
    senderEmail: requireEmail(record.senderEmail),
    senderName: requireString(record.senderName, "senderName"),
    username: requireString(record.username, "username"),
  };
}

function parseSalesJourneyEmailPayload(
  data: unknown,
): SalesJourneyEmailPayload {
  const record =
    typeof data === "object" && data ? (data as Record<string, unknown>) : {};
  return {
    body: requireString(record.body, "body"),
    leadId: requireString(record.leadId, "leadId"),
    organizationId: requireString(record.organizationId, "organizationId"),
    recipient:
      typeof record.recipient === "string" && record.recipient.trim()
        ? requireEmail(record.recipient)
        : undefined,
    subject: requireString(record.subject, "subject"),
  };
}

function parseBulkEmailPayload(data: unknown): BulkEmailPayload {
  const record =
    typeof data === "object" && data ? (data as Record<string, unknown>) : {};
  const recipientType =
    record.recipientType === "client"
      ? "client"
      : record.recipientType === "lead"
        ? "lead"
        : null;
  const recipientIds = Array.isArray(record.recipientIds)
    ? Array.from(
        new Set(
          record.recipientIds
            .filter(
              (id): id is string =>
                typeof id === "string" && Boolean(id.trim()),
            )
            .map((id) => id.trim()),
        ),
      )
    : [];

  if (!recipientType) {
    throw new HttpsError(
      "invalid-argument",
      "recipientType must be lead or client.",
    );
  }

  if (!recipientIds.length) {
    throw new HttpsError("invalid-argument", "Select at least one recipient.");
  }

  if (recipientIds.length > 50) {
    throw new HttpsError(
      "invalid-argument",
      "Send bulk email to 50 recipients or fewer at a time.",
    );
  }

  return {
    body: requireString(record.body, "body"),
    organizationId: requireString(record.organizationId, "organizationId"),
    recipientIds,
    recipientType,
    subject: requireString(record.subject, "subject"),
  };
}

function sanitizeEmailSettings(
  data: DocumentData | undefined,
  member: ActorContext,
) {
  return {
    enabled: data?.enabled === true,
    hasPassword:
      typeof data?.encryptedPassword === "string" &&
      Boolean(data.encryptedPassword),
    host: typeof data?.host === "string" ? data.host : "",
    port: typeof data?.port === "number" ? data.port : 587,
    replyTo: typeof data?.replyTo === "string" ? data.replyTo : "",
    secureMode:
      typeof data?.secureMode === "string" ? data.secureMode : "starttls",
    senderEmail:
      typeof data?.senderEmail === "string" ? data.senderEmail : member.email,
    senderName:
      typeof data?.senderName === "string"
        ? data.senderName
        : member.displayName,
    username: typeof data?.username === "string" ? data.username : member.email,
    updatedAt: data?.updatedAt ?? null,
  };
}

function emailSettingsDoc(organizationId: string, uid: string) {
  return db.doc(`organizations/${organizationId}/mailSettings/${uid}`);
}

function smtpTransport(settings: DocumentData) {
  if (
    !settings.encryptedPassword ||
    typeof settings.encryptedPassword !== "string"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Save your SMTP password before sending a test email.",
    );
  }

  const secureMode =
    settings.secureMode === "ssl"
      ? "ssl"
      : settings.secureMode === "none"
        ? "none"
        : "starttls";
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
  return name
    ? `"${name}" <${String(settings.senderEmail)}>`
    : String(settings.senderEmail);
}

async function getUsableEmailSettings(organizationId: string, uid: string) {
  const snapshot = await emailSettingsDoc(organizationId, uid).get();
  const settings = snapshot.data();
  if (!snapshot.exists || !settings) {
    throw new HttpsError(
      "failed-precondition",
      "Save your SMTP settings before sending email.",
    );
  }

  if (settings.enabled !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Your SMTP mailbox is disabled. Enable it in Email Settings before sending email.",
    );
  }

  return settings;
}

function ensureCanReadBulkRecipient(
  member: ActorContext,
  recipientType: BulkEmailPayload["recipientType"],
  record: DocumentData,
) {
  assertCanAccessRecordBranch(member, record);

  if (recipientType === "client") {
    if (!hasActorPermission(member, "clients.read")) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to email clients.",
      );
    }
    if (
      isAssignedOnlySalesActor(member) &&
      record.assignedRelationshipManager !== member.id &&
      record.assignedTo !== member.id
    ) {
      throw new HttpsError(
        "permission-denied",
        "You can only bulk email assigned clients.",
      );
    }
    return;
  }

  if (
    !hasActorPermission(member, "leads.readAll") &&
    record.assignedTo !== member.id
  ) {
    throw new HttpsError(
      "permission-denied",
      "You can only bulk email assigned leads.",
    );
  }

  if (
    !hasActorPermission(member, "leads.readAll") &&
    !hasActorPermission(member, "leads.readAssigned")
  ) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to email leads.",
    );
  }
}

async function getOrCreateUser(
  email: string,
  displayName: string,
): Promise<UserRecord> {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
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

function appInviteSetupLink(
  firebaseLink: string,
  email: string,
  origin?: string,
) {
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
    const firebaseLink = await auth.generatePasswordResetLink(email, {
      url: continueUrl,
    });
    return appInviteSetupLink(firebaseLink, email, origin);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code === "auth/unauthorized-continue-uri") {
      console.warn(
        "Invite continue URL is not authorized in Firebase Authentication; generated a setup link from the default Firebase action code.",
      );
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

  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code === "auth/invalid-email") {
    return new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  if (code === "auth/email-already-exists") {
    return new HttpsError(
      "already-exists",
      "A Firebase Auth user already exists for this email.",
    );
  }

  if (code === "auth/insufficient-permission") {
    return new HttpsError(
      "permission-denied",
      "The Functions service account cannot manage Firebase Auth users. Grant it Firebase Authentication admin permissions.",
    );
  }

  if (code === "auth/operation-not-allowed") {
    return new HttpsError(
      "failed-precondition",
      "Firebase Authentication is not configured for email/password users.",
    );
  }

  if (
    code === "7" ||
    (typeof error === "object" &&
      error &&
      "details" in error &&
      String(error.details).includes("Missing or insufficient permissions"))
  ) {
    return new HttpsError(
      "permission-denied",
      "The Functions runtime service account cannot access Firestore. Grant it Cloud Datastore User permission, then try again.",
    );
  }

  console.error("provisionOrganizationMember failed", error);
  return new HttpsError(
    "internal",
    "Unable to provision this user. Check Firebase Functions logs for details.",
  );
}

export const provisionOrganizationMember = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    try {
      const organizationId = requireString(
        request.data?.organizationId,
        "organizationId",
      );
      const branchId = requireString(request.data?.branchId, "branchId");
      const branchAccess = requireBranchAccess(request.data?.branchAccess);
      const displayName = requireString(
        request.data?.displayName,
        "displayName",
      );
      const email = requireEmail(request.data?.email);
      const roles = requireRoles(request.data?.roles, request.data?.role);
      const role = roles[0];
      const phoneNumber =
        typeof request.data?.phoneNumber === "string"
          ? request.data.phoneNumber.trim()
          : "";
      const actor = await getActor(request.auth.uid, organizationId);
      assertCanAssignRoles(actor, roles);
      assertCanGrantBranchAccess(actor, branchAccess);
      const partnerBrandIds = await requirePartnerBrandIds(
        organizationId,
        roles,
        request.data?.partnerBrandIds,
      );
      const partnerBranchIds: string[] = [];

      const user = await getOrCreateUser(email, displayName);
      const memberRef = db.doc(
        `organizations/${organizationId}/members/${user.uid}`,
      );
      const previous = await memberRef.get();
      assertCanManageTargetMember(actor, previous.data());

      await auth.updateUser(user.uid, { disabled: false, displayName });
      await auth.setCustomUserClaims(user.uid, { organizationId, role, roles });
      const payload = {
        branchId,
        branchAccess,
        createdAt: previous.exists
          ? (previous.data()?.createdAt ?? FieldValue.serverTimestamp())
          : FieldValue.serverTimestamp(),
        createdBy: previous.exists
          ? (previous.data()?.createdBy ?? request.auth.uid)
          : request.auth.uid,
        displayName,
        email,
        organizationId,
        permissions: permissionsForRoles(roles),
        partnerBrandIds,
        partnerBranchIds,
        phoneNumber,
        role,
        roles,
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      };

      await memberRef.set(payload, { merge: true });
      const origin =
        typeof request.rawRequest.headers.origin === "string"
          ? request.rawRequest.headers.origin
          : undefined;
      const setupLink = await generateInviteLinkForOrigin(email, origin);

      await writeAuditLog({
        action: previous.exists ? "member.updateInvite" : "member.invite",
        actorId: request.auth.uid,
        actorName: actor.displayName,
        branchId,
        entityId: user.uid,
        entityType: "member",
        newValue: {
          branchAccess,
          branchId,
          displayName,
          email,
          partnerBrandIds,
          partnerBranchIds,
          role,
          roles,
          setupLinkGenerated: true,
          status: "active",
        },
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
  },
);

export const resendOrganizationMemberInvite = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    try {
      const organizationId = requireString(
        request.data?.organizationId,
        "organizationId",
      );
      const uid = requireString(request.data?.uid, "uid");
      const actor = await getActor(request.auth.uid, organizationId);
      const memberRef = db.doc(
        `organizations/${organizationId}/members/${uid}`,
      );
      const memberSnapshot = await memberRef.get();
      const target = memberSnapshot.data();

      if (!memberSnapshot.exists || !target) {
        throw new HttpsError(
          "not-found",
          "This organization member was not found.",
        );
      }

      assertCanManageTargetMember(actor, target);

      if (target.status === "disabled") {
        throw new HttpsError(
          "failed-precondition",
          "Reactivate this user before generating a setup link.",
        );
      }

      const userRecord = await auth.getUser(uid);
      const email = requireEmail(userRecord.email ?? target.email);
      const origin =
        typeof request.rawRequest.headers.origin === "string"
          ? request.rawRequest.headers.origin
          : undefined;
      const setupLink = await generateInviteLinkForOrigin(email, origin);

      await writeAuditLog({
        action: "member.resendInvite",
        actorId: request.auth.uid,
        actorName: actor.displayName,
        branchId:
          typeof target.branchId === "string"
            ? target.branchId
            : actor.branchId,
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
  },
);

export const getEmailSmtpSettings = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(
    request.data?.organizationId,
    "organizationId",
  );
  const member = await getActiveMember(request.auth.uid, organizationId);
  assertCanUseEmailSettings(member);
  const snapshot = await emailSettingsDoc(
    organizationId,
    request.auth.uid,
  ).get();
  return sanitizeEmailSettings(snapshot.data(), member);
});

export const saveEmailSmtpSettings = onCall(
  mailSettingsSecretOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const member = await getActiveMember(request.auth.uid, organizationId);
    assertCanUseEmailSettings(member);
    const payload = parseEmailSettingsPayload(request.data);
    const ref = emailSettingsDoc(organizationId, request.auth.uid);
    const previous = await ref.get();
    const previousData = previous.data();
    const encryptedPassword = payload.password
      ? encryptSecret(payload.password)
      : previousData?.encryptedPassword;

    if (!encryptedPassword) {
      throw new HttpsError(
        "failed-precondition",
        "Enter your SMTP password before saving email settings.",
      );
    }

    await ref.set(
      {
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
      },
      { merge: true },
    );

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
      previousValue: previous.exists
        ? {
            enabled: previousData?.enabled,
            host: previousData?.host,
            port: previousData?.port,
            secureMode: previousData?.secureMode,
            senderEmail: previousData?.senderEmail,
            username: previousData?.username,
          }
        : null,
    });

    const next = await ref.get();
    return sanitizeEmailSettings(next.data(), member);
  },
);

export const sendEmailSmtpTest = onCall(
  mailSettingsSecretOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const member = await getActiveMember(request.auth.uid, organizationId);
    assertCanUseEmailSettings(member);
    const recipient =
      typeof request.data?.recipient === "string" &&
      request.data.recipient.trim()
        ? requireEmail(request.data.recipient)
        : member.email;
    const snapshot = await emailSettingsDoc(
      organizationId,
      request.auth.uid,
    ).get();
    const settings = snapshot.data();
    if (!snapshot.exists || !settings) {
      throw new HttpsError(
        "failed-precondition",
        "Save your SMTP settings before sending a test email.",
      );
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
  },
);

export const sendSalesJourneyEmail = onCall(
  mailSettingsSecretOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const payload = parseSalesJourneyEmailPayload(request.data);
    const member = await getActiveMember(
      request.auth.uid,
      payload.organizationId,
    );
    if (!hasActorPermission(member, "activities.create")) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to send sales journey emails.",
      );
    }

    const leadRef = db.doc(
      `organizations/${payload.organizationId}/leads/${payload.leadId}`,
    );
    const leadSnapshot = await leadRef.get();
    const lead = leadSnapshot.data();
    if (!leadSnapshot.exists || !lead || lead.isDeleted === true) {
      throw new HttpsError("not-found", "Lead not found.");
    }

    assertCanAccessRecordBranch(member, lead);

    if (
      !hasActorPermission(member, "leads.readAll") &&
      lead.assignedTo &&
      lead.assignedTo !== request.auth.uid
    ) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this lead.",
      );
    }

    const recipient = payload.recipient ?? requireEmail(lead.email);
    const settings = await getUsableEmailSettings(
      payload.organizationId,
      request.auth.uid,
    );
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

    const activityRef = await db
      .collection(`organizations/${payload.organizationId}/activities`)
      .add({
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
      newValue: {
        activityId: activityRef.id,
        recipient,
        subject: payload.subject,
      },
      organizationId: payload.organizationId,
    });

    return { activityId: activityRef.id, ok: true };
  },
);

export const sendBulkSalesEmail = onCall(
  mailSettingsSecretOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const actorId = request.auth.uid;
    const payload = parseBulkEmailPayload(request.data);
    const member = await getActiveMember(actorId, payload.organizationId);
    if (!hasActorPermission(member, "activities.create")) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to send sales emails.",
      );
    }

    if (
      payload.recipientType === "client" &&
      !hasActorPermission(member, "clients.read")
    ) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to email clients.",
      );
    }

    if (
      payload.recipientType === "lead" &&
      !hasActorPermission(member, "leads.readAll") &&
      !hasActorPermission(member, "leads.readAssigned")
    ) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to email leads.",
      );
    }

    const settings = await getUsableEmailSettings(
      payload.organizationId,
      actorId,
    );
    const transport = smtpTransport(settings);
    const collectionName =
      payload.recipientType === "lead" ? "leads" : "clients";
    const refs = payload.recipientIds.map((id) =>
      db.doc(`organizations/${payload.organizationId}/${collectionName}/${id}`),
    );
    const snapshots = await db.getAll(...refs);
    const sent: Array<{ email: string; id: string; name: string }> = [];
    const failed: Array<{ id: string; name: string; reason: string }> = [];
    const skipped: Array<{ id: string; name: string; reason: string }> = [];

    for (const snapshot of snapshots) {
      const record = snapshot.data();
      const name = String(
        record?.fullName ??
          record?.companyName ??
          record?.name ??
          record?.referenceNumber ??
          snapshot.id,
      );
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
        skipped.push({
          id: snapshot.id,
          name,
          reason: "Invalid email address.",
        });
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
        const activityRef = db
          .collection(`organizations/${payload.organizationId}/activities`)
          .doc();
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

        const recipientRef = db.doc(
          `organizations/${payload.organizationId}/${collectionName}/${recipient.id}`,
        );
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
              ...(Array.isArray(record.stageHistory)
                ? record.stageHistory
                : []),
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
  },
);

export const updateOrganizationMemberRole = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const branchId = requireString(request.data?.branchId, "branchId");
    const branchAccess = requireBranchAccess(request.data?.branchAccess);
    const targetUid = requireString(request.data?.uid, "uid");
    const roles = requireRoles(request.data?.roles, request.data?.role);
    const role = roles[0];
    const actor = await getActor(request.auth.uid, organizationId);
    assertCanAssignRoles(actor, roles);
    assertCanGrantBranchAccess(actor, branchAccess);
    const partnerBrandIds = await requirePartnerBrandIds(
      organizationId,
      roles,
      request.data?.partnerBrandIds,
    );
    const partnerBranchIds: string[] = [];

    if (targetUid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot change your own role or branch.",
      );
    }

    const memberRef = db.doc(
      `organizations/${organizationId}/members/${targetUid}`,
    );
    const previous = await memberRef.get();
    if (!previous.exists) {
      throw new HttpsError("not-found", "Member not found.");
    }
    assertCanManageTargetMember(actor, previous.data());

    await memberRef.update({
      branchId,
      branchAccess,
      permissions: permissionsForRoles(roles),
      partnerBrandIds,
      partnerBranchIds,
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
      newValue: {
        branchAccess,
        branchId,
        partnerBrandIds,
        partnerBranchIds,
        role,
        roles,
      },
      organizationId,
      previousValue: previous.data(),
    });

    return { ok: true };
  },
);

export const disableOrganizationMember = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const targetUid = requireString(request.data?.uid, "uid");
    if (targetUid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot disable your own account.",
      );
    }

    const actor = await getActor(request.auth.uid, organizationId);
    const memberRef = db.doc(
      `organizations/${organizationId}/members/${targetUid}`,
    );
    const previous = await memberRef.get();
    if (!previous.exists) {
      throw new HttpsError("not-found", "Member not found.");
    }
    assertCanManageTargetMember(actor, previous.data());

    await auth.updateUser(targetUid, { disabled: true });
    await memberRef.update({
      status: "disabled",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    });
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
  },
);

export const reactivateOrganizationMember = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const targetUid = requireString(request.data?.uid, "uid");
    const actor = await getActor(request.auth.uid, organizationId);
    const memberRef = db.doc(
      `organizations/${organizationId}/members/${targetUid}`,
    );
    const previous = await memberRef.get();
    if (!previous.exists) {
      throw new HttpsError("not-found", "Member not found.");
    }
    assertCanManageTargetMember(actor, previous.data());

    await auth.updateUser(targetUid, { disabled: false });
    await memberRef.update({
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    });
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
  },
);

export const convertLeadToClient = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { leadId, organizationId } = request.data as {
    leadId: string;
    organizationId: string;
  };
  const member = await db
    .doc(`organizations/${organizationId}/members/${request.auth.uid}`)
    .get();
  const memberData = member.data();
  const permissions = memberData?.permissions as string[] | undefined;
  if (!member.exists || !permissions?.includes("clients.create")) {
    throw new HttpsError("permission-denied", "You cannot convert leads.");
  }

  const leadRef = db.doc(`organizations/${organizationId}/leads/${leadId}`);
  const clientRef = db
    .collection(`organizations/${organizationId}/clients`)
    .doc();
  let convertedLead: DocumentData | undefined;
  const actorName = String(
    memberData?.displayName ?? request.auth.token.email ?? request.auth.uid,
  );
  const actorEmail = String(
    memberData?.email ?? request.auth.token.email ?? "",
  );
  await db.runTransaction(async (transaction) => {
    const lead = await transaction.get(leadRef);
    if (!lead.exists) {
      throw new HttpsError("not-found", "Lead not found.");
    }

    const data = lead.data();
    if (data?.status === "converted") {
      throw new HttpsError(
        "failed-precondition",
        "Lead has already been converted.",
      );
    }

    if (data?.status === "lost") {
      throw new HttpsError(
        "failed-precondition",
        "Lost leads must be reopened before conversion.",
      );
    }

    convertedLead = data;
    const stageHistory = Array.isArray(data?.stageHistory)
      ? data.stageHistory
      : [];
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

export const writeProtectedAuditLog = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const {
      action,
      branchId,
      entityId,
      entityType,
      newValue,
      organizationId,
      previousValue,
    } = request.data as Record<string, unknown>;
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
  },
);

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
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/notifications";
}

export const deliverNotificationPush = onDocumentCreated(
  "organizations/{organizationId}/notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    const organizationId = event.params.organizationId;
    const notificationId = event.params.notificationId;
    const recipientId =
      typeof notification?.recipientId === "string"
        ? notification.recipientId
        : "";
    if (!notification || !recipientId || notification.isDeleted === true) {
      return;
    }

    const subscriptionSnapshot = await db
      .collection(`organizations/${organizationId}/pushSubscriptions`)
      .where("userId", "==", recipientId)
      .where("status", "==", "active")
      .get();
    const subscriptions = subscriptionSnapshot.docs.filter((item) => {
      const data = item.data();
      return (
        data.isDeleted === false &&
        typeof data.token === "string" &&
        data.token.length > 20
      );
    });
    if (!subscriptions.length) {
      return;
    }

    const data = {
      body: pushText(
        notification.body,
        "You have a new CRM notification.",
        240,
      ),
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
          headers: {
            Urgency: notification.tone === "danger" ? "high" : "normal",
          },
        },
      });

      const staleSubscriptions = response.responses.flatMap(
        (result, resultIndex) => {
          if (
            !result.success &&
            result.error?.code &&
            stalePushTokenCodes.has(result.error.code)
          ) {
            return [batch[resultIndex].ref.delete()];
          }
          return [];
        },
      );
      await Promise.all(staleSubscriptions);
    }
  },
);

type StockLocationSnapshot = {
  exists: boolean;
  id: string;
  data(): DocumentData | undefined;
};

function resolveStockLocation(
  branchSnapshot: StockLocationSnapshot | null,
  legacySnapshot: StockLocationSnapshot | null,
) {
  if (branchSnapshot?.exists) {
    const branch = branchSnapshot.data() ?? {};
    if (branch.status === "closed") return null;
    return {
      ...branch,
      branchId: branchSnapshot.id,
      locationType: "store",
      status: "active",
    };
  }
  if (legacySnapshot?.exists) {
    const location = legacySnapshot.data() ?? {};
    if (location.status === "inactive" || location.isDeleted === true) return null;
    return location;
  }
  return null;
}

const inventoryMovementPermission: Record<string, string> = {
  receipt: "inventory.receive",
  issue: "inventory.issue",
  adjustmentIn: "inventory.adjust",
  adjustmentOut: "inventory.adjust",
  transfer: "inventory.transfer",
  returnIn: "inventory.receive",
  returnOut: "inventory.issue",
};

export const recordInventoryMovement = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");

    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const branchId = requireString(request.data?.branchId, "branchId");
    const offeringId = requireString(request.data?.offeringId, "offeringId");
    const movementType = requireString(
      request.data?.movementType,
      "movementType",
    );
    const movementPurpose = [
      "sale",
      "project",
      "internalUse",
      "other",
    ].includes(request.data?.movementPurpose)
      ? (request.data.movementPurpose as string)
      : "other";
    const permission = inventoryMovementPermission[movementType];
    if (!permission)
      throw new HttpsError(
        "invalid-argument",
        "Unsupported inventory movement type.",
      );
    const quantity = requireNumber(request.data?.quantity, "quantity");
    if (quantity <= 0)
      throw new HttpsError(
        "invalid-argument",
        "Quantity must be greater than zero.",
      );

    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasActorPermission(actor, permission))
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to record this stock movement.",
      );
    if (!canActorAccessBranch(actor, branchId))
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this branch.",
      );

    const fromLocationId =
      typeof request.data?.fromLocationId === "string"
        ? request.data.fromLocationId.trim()
        : "";
    const toLocationId =
      typeof request.data?.toLocationId === "string"
        ? request.data.toLocationId.trim()
        : "";
    const needsFrom = [
      "issue",
      "adjustmentOut",
      "transfer",
      "returnOut",
    ].includes(movementType);
    const needsTo = [
      "receipt",
      "adjustmentIn",
      "transfer",
      "returnIn",
    ].includes(movementType);
    if (needsFrom && !fromLocationId)
      throw new HttpsError(
        "invalid-argument",
        "A source location is required.",
      );
    if (needsTo && !toLocationId)
      throw new HttpsError(
        "invalid-argument",
        "A destination location is required.",
      );
    if (movementType === "transfer" && fromLocationId === toLocationId)
      throw new HttpsError(
        "invalid-argument",
        "Transfer locations must be different.",
      );
    if (movementPurpose === "sale" && movementType !== "issue")
      throw new HttpsError(
        "invalid-argument",
        "Sale purpose is only valid for an inventory issue.",
      );
    if (
      movementPurpose === "sale" &&
      (typeof request.data?.externalReference !== "string" ||
        !request.data.externalReference.trim())
    )
      throw new HttpsError(
        "invalid-argument",
        "Enter the deal, invoice, or sale reference.",
      );

    const offeringRef = db.doc(
      `organizations/${organizationId}/offerings/${offeringId}`,
    );
    const fromLocationRef = fromLocationId
      ? db.doc(
          `organizations/${organizationId}/inventoryLocations/${fromLocationId}`,
        )
      : null;
    const fromBranchRef = fromLocationId
      ? db.doc(`organizations/${organizationId}/branches/${fromLocationId}`)
      : null;
    const toLocationRef = toLocationId
      ? db.doc(
          `organizations/${organizationId}/inventoryLocations/${toLocationId}`,
        )
      : null;
    const toBranchRef = toLocationId
      ? db.doc(`organizations/${organizationId}/branches/${toLocationId}`)
      : null;
    const fromBalanceRef = fromLocationId
      ? db.doc(
          `organizations/${organizationId}/inventoryBalances/${offeringId}_${fromLocationId}`,
        )
      : null;
    const toBalanceRef = toLocationId
      ? db.doc(
          `organizations/${organizationId}/inventoryBalances/${offeringId}_${toLocationId}`,
        )
      : null;
    const movementRef = db
      .collection(`organizations/${organizationId}/inventoryMovements`)
      .doc();
    const referenceNumber = `MOV-${Date.now().toString(36).toUpperCase()}-${movementRef.id.slice(0, 5).toUpperCase()}`;
    const offeringBeforeTransaction = await offeringRef.get();
    if (!offeringBeforeTransaction.exists)
      throw new HttpsError("not-found", "Inventory item was not found.");
    const trackingMode =
      offeringBeforeTransaction.data()?.trackingMode === "serial"
        ? "serial"
        : offeringBeforeTransaction.data()?.trackingMode === "batch"
          ? "batch"
          : "none";
    const batchNumber =
      typeof request.data?.batchNumber === "string"
        ? request.data.batchNumber.trim()
        : "";
    const serialNumbers = Array.isArray(request.data?.serialNumbers)
      ? Array.from(
          new Set(
            request.data.serialNumbers
              .filter(
                (value: unknown): value is string =>
                  typeof value === "string" && Boolean(value.trim()),
              )
              .map((value: string) => value.trim()),
          ),
        )
      : [];
    if (trackingMode === "batch" && !batchNumber)
      throw new HttpsError(
        "invalid-argument",
        "A batch number is required for this item.",
      );
    if (
      trackingMode === "serial" &&
      serialNumbers.length > 0 &&
      (!Number.isInteger(quantity) || serialNumbers.length !== quantity)
    )
      throw new HttpsError(
        "invalid-argument",
        "When serial numbers are provided, enter one unique serial number for every unit.",
      );
    const traceId = (value: string) =>
      createHash("sha256").update(value).digest("hex").slice(0, 32);
    const fromLotRef =
      trackingMode === "batch" && fromLocationId
        ? db.doc(
            `organizations/${organizationId}/inventoryLots/${traceId(`${offeringId}|${batchNumber}|${fromLocationId}`)}`,
          )
        : null;
    const toLotRef =
      trackingMode === "batch" && toLocationId
        ? db.doc(
            `organizations/${organizationId}/inventoryLots/${traceId(`${offeringId}|${batchNumber}|${toLocationId}`)}`,
          )
        : null;
    const serialRefs =
      trackingMode === "serial"
        ? serialNumbers.map((serialNumber) =>
            db.doc(
              `organizations/${organizationId}/inventorySerials/${traceId(`${offeringId}|${serialNumber}`)}`,
            ),
          )
        : [];

    await db.runTransaction(async (transaction) => {
      const [
        offeringSnapshot,
        fromLocationSnapshot,
        fromBranchSnapshot,
        toLocationSnapshot,
        toBranchSnapshot,
        fromBalanceSnapshot,
        toBalanceSnapshot,
        fromLotSnapshot,
        toLotSnapshot,
      ] = await Promise.all([
        transaction.get(offeringRef),
        fromLocationRef ? transaction.get(fromLocationRef) : null,
        fromBranchRef ? transaction.get(fromBranchRef) : null,
        toLocationRef ? transaction.get(toLocationRef) : null,
        toBranchRef ? transaction.get(toBranchRef) : null,
        fromBalanceRef ? transaction.get(fromBalanceRef) : null,
        toBalanceRef ? transaction.get(toBalanceRef) : null,
        fromLotRef ? transaction.get(fromLotRef) : null,
        toLotRef ? transaction.get(toLotRef) : null,
      ]);
      const serialSnapshots = await Promise.all(
        serialRefs.map((ref) => transaction.get(ref)),
      );
      if (!offeringSnapshot.exists)
        throw new HttpsError("not-found", "Inventory item was not found.");
      const offering = offeringSnapshot.data() ?? {};
      const fromLocation = resolveStockLocation(
        fromBranchSnapshot,
        fromLocationSnapshot,
      );
      const toLocation = resolveStockLocation(
        toBranchSnapshot,
        toLocationSnapshot,
      );
      if (
        offering.isDeleted === true ||
        !offering.brandId
      )
        throw new HttpsError(
          "failed-precondition",
          "The item must be active and linked to a brand.",
        );
      const fromBranchId = String(fromLocation?.branchId ?? "");
      const toBranchId = String(toLocation?.branchId ?? "");
      if (
        fromLocationRef &&
        (!fromLocation ||
          fromBranchId !== branchId ||
          !canActorAccessBranch(actor, fromBranchId))
      )
        throw new HttpsError(
          "failed-precondition",
          "Source location must belong to the active branch.",
        );
      if (
        toLocationRef &&
        (!toLocation ||
          !canActorAccessBranch(actor, toBranchId) ||
          (movementType !== "transfer" && toBranchId !== branchId))
      )
        throw new HttpsError(
          "permission-denied",
          movementType === "transfer"
            ? "You do not have access to the destination branch."
            : "Destination location must belong to the active branch.",
        );

      const fromQuantity = Number(
        fromBalanceSnapshot?.data()?.quantityOnHand ?? 0,
      );
      const fromReserved = Number(
        fromBalanceSnapshot?.data()?.quantityReserved ?? 0,
      );
      if (needsFrom && fromQuantity - fromReserved < quantity)
        throw new HttpsError(
          "failed-precondition",
          `Only ${fromQuantity - fromReserved} unreserved units are available at the source location.`,
        );
      const commonBalance = {
        organizationId,
        brandId: offering.brandId,
        brandName: offering.brandName ?? "",
        offeringId,
        offeringName:
          offering.name ?? offering.referenceNumber ?? "Inventory item",
        sku: offering.sku ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      };
      if (fromBalanceRef && fromLocation)
        transaction.set(
          fromBalanceRef,
          {
            ...commonBalance,
            branchId: fromBranchId,
            locationId: fromLocationId,
            locationName: fromLocation.name ?? "",
            quantityOnHand: fromQuantity - quantity,
            quantityReserved: fromReserved,
          },
          { merge: true },
        );
      if (toBalanceRef && toLocation)
        transaction.set(
          toBalanceRef,
          {
            ...commonBalance,
            branchId: toBranchId,
            locationId: toLocationId,
            locationName: toLocation.name ?? "",
            quantityOnHand:
              Number(toBalanceSnapshot?.data()?.quantityOnHand ?? 0) + quantity,
            quantityReserved: Number(
              toBalanceSnapshot?.data()?.quantityReserved ?? 0,
            ),
          },
          { merge: true },
        );

      if (trackingMode === "batch") {
        const fromLotQuantity = Number(
          fromLotSnapshot?.data()?.quantityOnHand ?? 0,
        );
        const fromLotReserved = Number(
          fromLotSnapshot?.data()?.quantityReserved ?? 0,
        );
        if (needsFrom && fromLotQuantity - fromLotReserved < quantity)
          throw new HttpsError(
            "failed-precondition",
            `Batch ${batchNumber} has only ${fromLotQuantity - fromLotReserved} unreserved units available.`,
          );
        const lotCommon = {
          organizationId,
          brandId: offering.brandId,
          offeringId,
          offeringName: offering.name ?? "Inventory item",
          batchNumber,
          expiryDate: request.data?.expiryDate
            ? new Date(String(request.data.expiryDate))
            : null,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (fromLotRef && fromLocation)
          transaction.set(
            fromLotRef,
            {
              ...lotCommon,
              branchId: fromBranchId,
              locationId: fromLocationId,
              locationName: fromLocation.name ?? "",
              quantityOnHand: fromLotQuantity - quantity,
              quantityReserved: fromLotReserved,
            },
            { merge: true },
          );
        if (toLotRef && toLocation)
          transaction.set(
            toLotRef,
            {
              ...lotCommon,
              branchId: toBranchId,
              locationId: toLocationId,
              locationName: toLocation.name ?? "",
              quantityOnHand:
                Number(toLotSnapshot?.data()?.quantityOnHand ?? 0) + quantity,
              quantityReserved: Number(
                toLotSnapshot?.data()?.quantityReserved ?? 0,
              ),
            },
            { merge: true },
          );
      }
      if (trackingMode === "serial") {
        serialSnapshots.forEach((snapshot, index) => {
          const serialNumber = serialNumbers[index];
          if (
            needsFrom &&
            (!snapshot.exists ||
              snapshot.data()?.locationId !== fromLocationId ||
              snapshot.data()?.status !== "available")
          )
            throw new HttpsError(
              "failed-precondition",
              `Serial ${serialNumber} is not available at the source location.`,
            );
          if (!needsFrom && snapshot.exists && movementType !== "returnIn")
            throw new HttpsError(
              "already-exists",
              `Serial ${serialNumber} already exists.`,
            );
          const targetLocationId = needsTo ? toLocationId : fromLocationId;
          const targetLocationName = needsTo
            ? (toLocation?.name ?? "")
            : (fromLocation?.name ?? "");
          const targetBranchId = needsTo ? toBranchId : fromBranchId;
          transaction.set(
            serialRefs[index],
            {
              organizationId,
              branchId: targetBranchId,
              brandId: offering.brandId,
              offeringId,
              offeringName: offering.name ?? "Inventory item",
              serialNumber,
              locationId: targetLocationId,
              locationName: targetLocationName,
              status: needsTo ? "available" : "issued",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });
      }

      const totalDelta =
        needsTo && !needsFrom
          ? quantity
          : needsFrom && !needsTo
            ? -quantity
            : 0;
      transaction.update(offeringRef, {
        stockQuantity: FieldValue.increment(totalDelta),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
      transaction.set(movementRef, {
        organizationId,
        branchId,
        brandId: offering.brandId,
        brandName: offering.brandName ?? "",
        offeringId,
        offeringName:
          offering.name ?? offering.referenceNumber ?? "Inventory item",
        sku: offering.sku ?? "",
        movementType,
        movementPurpose,
        quantity,
        fromBranchId,
        fromLocationId,
        fromLocationName: fromLocation?.name ?? "",
        toBranchId,
        toLocationId,
        toLocationName: toLocation?.name ?? "",
        externalReference:
          typeof request.data?.externalReference === "string"
            ? request.data.externalReference.trim()
            : "",
        notes:
          typeof request.data?.notes === "string"
            ? request.data.notes.trim()
            : "",
        batchNumber,
        expiryDate: request.data?.expiryDate
          ? new Date(String(request.data.expiryDate))
          : null,
        serialNumbers,
        occurredAt:
          typeof request.data?.occurredAt === "string" &&
          request.data.occurredAt
            ? new Date(request.data.occurredAt)
            : new Date(),
        referenceNumber,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByEmail: actor.email,
        createdByName: actor.displayName,
        isDeleted: false,
      });
    });

    return { movementId: movementRef.id, referenceNumber };
  },
);

const posPaymentMethods = new Set([
  "cash",
  "bankTransfer",
  "card",
  "cheque",
  "mobileMoney",
  "onlinePayment",
  "other",
]);

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function officialSalesDocumentNumber(
  branchCode: unknown,
  documentType: "SAL" | "INV" | "RCT",
  date: Date,
  uniqueId: string,
) {
  const safeBranchCode = String(branchCode || "HQ")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "HQ";
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Lagos",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((entry) => entry.type === type)?.value ?? "";
  return `VSL/${safeBranchCode}/${documentType}/${part("year")}/${part("month")}${part("day")}/${uniqueId.slice(0, 6).toUpperCase()}`;
}

export const createPosSale = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const branchId = requireString(request.data?.branchId, "branchId");
  const actor = await getActiveMember(request.auth.uid, organizationId);
  if (!hasActorPermission(actor, "pos.sell")) {
    throw new HttpsError("permission-denied", "You do not have permission to record POS sales.");
  }
  if (!canActorAccessBranch(actor, branchId)) {
    throw new HttpsError("permission-denied", "You do not have access to this branch.");
  }

  const rawLines: unknown[] = Array.isArray(request.data?.lines) ? request.data.lines : [];
  if (!rawLines.length || rawLines.length > 100) {
    throw new HttpsError("invalid-argument", "Add between 1 and 100 products to the sale.");
  }
  const normalizedLines = rawLines.map((raw: unknown) => {
    const line = (raw ?? {}) as Record<string, unknown>;
    const offeringId = requireString(line.offeringId, "offeringId");
    const quantity = requireNumber(line.quantity, "quantity");
    const discountAmount = line.discountAmount === undefined ? 0 : requireNumber(line.discountAmount, "discountAmount");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpsError("invalid-argument", "Sale quantities must be positive whole numbers.");
    }
    if (discountAmount < 0) {
      throw new HttpsError("invalid-argument", "Line discounts cannot be negative.");
    }
    return { offeringId, quantity, discountAmount: money(discountAmount) };
  });
  if (new Set(normalizedLines.map((line) => line.offeringId)).size !== normalizedLines.length) {
    throw new HttpsError("invalid-argument", "Each product can appear only once in a sale.");
  }

  const taxRate = request.data?.taxRate === undefined ? 0 : requireNumber(request.data.taxRate, "taxRate");
  if (taxRate < 0 || taxRate > 100) {
    throw new HttpsError("invalid-argument", "Tax rate must be between 0 and 100.");
  }
  const amountPaid = request.data?.amountPaid === undefined ? 0 : requireNumber(request.data.amountPaid, "amountPaid");
  if (amountPaid < 0) {
    throw new HttpsError("invalid-argument", "Amount paid cannot be negative.");
  }
  const paymentMethod = typeof request.data?.paymentMethod === "string" ? request.data.paymentMethod : "";
  if (amountPaid > 0 && !posPaymentMethods.has(paymentMethod)) {
    throw new HttpsError("invalid-argument", "Select a payment method for the amount received.");
  }
  const customerName = typeof request.data?.customerName === "string" && request.data.customerName.trim()
    ? request.data.customerName.trim().slice(0, 160)
    : "Walk-in customer";
  const soldAt = request.data?.soldAt ? new Date(String(request.data.soldAt)) : new Date();
  if (Number.isNaN(soldAt.getTime())) {
    throw new HttpsError("invalid-argument", "Enter a valid sale date.");
  }

  const saleRef = db.collection(`organizations/${organizationId}/posSales`).doc();
  const suffix = `${Date.now().toString(36).toUpperCase()}-${saleRef.id.slice(0, 5).toUpperCase()}`;
  let referenceNumber = `SAL-${suffix}`;
  let invoiceNumber = `INV-${suffix}`;
  let receiptNumber = amountPaid > 0 ? `RCT-${suffix}` : "";
  let branchCode = "HQ";
  const branchRef = db.doc(`organizations/${organizationId}/branches/${branchId}`);
  const offeringRefs = normalizedLines.map((line) => db.doc(`organizations/${organizationId}/offerings/${line.offeringId}`));
  const balanceRefs = normalizedLines.map((line) => db.doc(`organizations/${organizationId}/inventoryBalances/${line.offeringId}_${branchId}`));
  const movementRefs = normalizedLines.map(() => db.collection(`organizations/${organizationId}/inventoryMovements`).doc());
  const paymentRef = amountPaid > 0 ? db.collection(`organizations/${organizationId}/financePayments`).doc() : null;

  let resultTotal = 0;
  await db.runTransaction(async (transaction) => {
    const [branchSnapshot, ...snapshots] = await Promise.all([
      transaction.get(branchRef),
      ...offeringRefs.map((ref) => transaction.get(ref)),
      ...balanceRefs.map((ref) => transaction.get(ref)),
    ]);
    if (!branchSnapshot.exists || branchSnapshot.data()?.status === "closed") {
      throw new HttpsError("failed-precondition", "The selected branch is not active.");
    }
    branchCode = String(branchSnapshot.data()?.code || branchId);
    referenceNumber = officialSalesDocumentNumber(branchCode, "SAL", soldAt, saleRef.id);
    invoiceNumber = officialSalesDocumentNumber(branchCode, "INV", soldAt, saleRef.id);
    receiptNumber = amountPaid > 0
      ? officialSalesDocumentNumber(branchCode, "RCT", soldAt, paymentRef?.id ?? saleRef.id)
      : "";
    const offeringSnapshots = snapshots.slice(0, normalizedLines.length);
    const balanceSnapshots = snapshots.slice(normalizedLines.length);
    const saleLines = normalizedLines.map((line, index) => {
      const offeringSnapshot = offeringSnapshots[index];
      const balanceSnapshot = balanceSnapshots[index];
      if (!offeringSnapshot.exists) {
        throw new HttpsError("not-found", "A product in the cart was not found.");
      }
      const offering = offeringSnapshot.data() ?? {};
      if (offering.isDeleted === true || offering.status !== "active" || !offering.brandId) {
        throw new HttpsError("failed-precondition", `${offering.name ?? "A product"} is not available for sale.`);
      }
      if (offering.trackingMode === "batch") {
        throw new HttpsError("failed-precondition", `${offering.name ?? "This product"} is batch-controlled. Issue it from Inventory until POS batch selection is enabled.`);
      }
      const balance = balanceSnapshot.data() ?? {};
      const onHand = Number(balance.quantityOnHand ?? 0);
      const reserved = Number(balance.quantityReserved ?? 0);
      const available = onHand - reserved;
      if (available < line.quantity) {
        throw new HttpsError("failed-precondition", `${offering.name ?? "A product"} has only ${available} available units in this branch.`);
      }
      const unitPrice = money(Number(offering.sellingPrice ?? 0));
      if (unitPrice < 0) {
        throw new HttpsError("failed-precondition", `${offering.name ?? "A product"} has an invalid selling price.`);
      }
      const gross = money(unitPrice * line.quantity);
      if (line.discountAmount > gross) {
        throw new HttpsError("invalid-argument", `Discount exceeds the value of ${offering.name ?? "a product"}.`);
      }
      return {
        offeringId: line.offeringId,
        offeringName: String(offering.name ?? offering.referenceNumber ?? "Inventory item"),
        brandId: String(offering.brandId),
        brandName: String(offering.brandName ?? ""),
        sku: String(offering.sku ?? ""),
        quantity: line.quantity,
        unitPrice,
        discountAmount: line.discountAmount,
        lineTotal: money(gross - line.discountAmount),
        unitCost: money(Number(offering.costPrice ?? 0)),
      };
    });
    const subtotal = money(saleLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
    const discountAmount = money(saleLines.reduce((sum, line) => sum + line.discountAmount, 0));
    const taxableAmount = money(subtotal - discountAmount);
    const taxAmount = money(taxableAmount * taxRate / 100);
    const totalAmount = money(taxableAmount + taxAmount);
    if (amountPaid > totalAmount) {
      throw new HttpsError("invalid-argument", "Amount paid cannot exceed the sale total.");
    }
    const paid = money(amountPaid);
    const balanceDue = money(totalAmount - paid);
    const paymentStatus = paid <= 0 ? "unpaid" : balanceDue > 0 ? "partPaid" : "paid";
    resultTotal = totalAmount;

    saleLines.forEach((line, index) => {
      const balance = balanceSnapshots[index].data() ?? {};
      transaction.set(balanceRefs[index], {
        organizationId,
        branchId,
        brandId: line.brandId,
        brandName: line.brandName,
        offeringId: line.offeringId,
        offeringName: line.offeringName,
        sku: line.sku,
        locationId: branchId,
        locationName: String(branchSnapshot.data()?.name ?? ""),
        quantityOnHand: Number(balance.quantityOnHand ?? 0) - line.quantity,
        quantityReserved: Number(balance.quantityReserved ?? 0),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      }, { merge: true });
      transaction.update(offeringRefs[index], {
        stockQuantity: FieldValue.increment(-line.quantity),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
      transaction.set(movementRefs[index], {
        organizationId,
        branchId,
        brandId: line.brandId,
        brandName: line.brandName,
        offeringId: line.offeringId,
        offeringName: line.offeringName,
        sku: line.sku,
        movementType: "issue",
        movementPurpose: "sale",
        quantity: line.quantity,
        fromBranchId: branchId,
        fromLocationId: branchId,
        fromLocationName: String(branchSnapshot.data()?.name ?? ""),
        toBranchId: "",
        toLocationId: "",
        toLocationName: "",
        referenceNumber: `MOV-${suffix}-${index + 1}`,
        externalReference: referenceNumber,
        notes: `POS sale ${invoiceNumber}`,
        occurredAt: soldAt,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByEmail: actor.email,
        createdByName: actor.displayName,
        isDeleted: false,
      });
    });

    transaction.set(saleRef, {
      organizationId,
      branchId,
      branchCode,
      referenceNumber,
      invoiceNumber,
      receiptNumber,
      customerName,
      customerPhone: typeof request.data?.customerPhone === "string" ? request.data.customerPhone.trim().slice(0, 60) : "",
      customerEmail: typeof request.data?.customerEmail === "string" ? request.data.customerEmail.trim().slice(0, 160) : "",
      customerAddress: typeof request.data?.customerAddress === "string" ? request.data.customerAddress.trim().slice(0, 500) : "",
      lines: saleLines,
      subtotal,
      discountAmount,
      taxRate,
      taxAmount,
      totalAmount,
      amountPaid: paid,
      balanceDue,
      paymentStatus,
      paymentMethod,
      paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
      paymentHistory: paymentRef ? [{
        paymentId: paymentRef.id,
        receiptNumber,
        amount: paid,
        at: soldAt.toISOString(),
        method: paymentMethod,
        paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
        recordedBy: actor.id,
      }] : [],
      saleStatus: "completed",
      soldAt,
      notes: typeof request.data?.notes === "string" ? request.data.notes.trim().slice(0, 1000) : "",
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdByName: actor.displayName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
      updatedByEmail: actor.email,
      updatedByName: actor.displayName,
      isDeleted: false,
    });

    if (paymentRef) {
      transaction.set(paymentRef, {
        organizationId,
        branchId,
        referenceNumber: receiptNumber,
        receiptNumber,
        sourceType: "posSale",
        sourceId: saleRef.id,
        sourceReference: referenceNumber,
        payerName: customerName,
        revenueCategory: "other",
        revenueOwnerId: actor.id,
        revenueOwnerName: actor.displayName,
        amount: paid,
        at: soldAt.toISOString().slice(0, 10),
        method: paymentMethod,
        paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
        note: `POS payment for ${invoiceNumber}`,
        verificationStatus: "verified",
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: actor.id,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByEmail: actor.email,
        createdByName: actor.displayName,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
        updatedByEmail: actor.email,
        updatedByName: actor.displayName,
        isDeleted: false,
      });
    }
  });

  return { saleId: saleRef.id, referenceNumber, invoiceNumber, receiptNumber, totalAmount: resultTotal };
});

export const recordPosSalePayment = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const organizationId = requireString(request.data?.organizationId, "organizationId");
  const saleId = requireString(request.data?.saleId, "saleId");
  const amount = money(requireNumber(request.data?.amount, "amount"));
  const paymentMethod = requireString(request.data?.paymentMethod, "paymentMethod");
  if (amount <= 0 || !posPaymentMethods.has(paymentMethod)) {
    throw new HttpsError("invalid-argument", "Enter a positive amount and valid payment method.");
  }
  const actor = await getActiveMember(request.auth.uid, organizationId);
  if (!hasAnyActorPermission(actor, ["pos.sell", "finance.create"])) {
    throw new HttpsError("permission-denied", "You do not have permission to record this payment.");
  }
  const saleRef = db.doc(`organizations/${organizationId}/posSales/${saleId}`);
  const paymentRef = db.collection(`organizations/${organizationId}/financePayments`).doc();
  let receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}-${paymentRef.id.slice(0, 5).toUpperCase()}`;
  let balanceDue = 0;
  let paymentStatus = "unpaid";

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(saleRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "POS sale was not found.");
    }
    const sale = snapshot.data() ?? {};
    if (!canActorAccessBranch(actor, String(sale.branchId ?? ""))) {
      throw new HttpsError("permission-denied", "You do not have access to this sale's branch.");
    }
    if (sale.saleStatus !== "completed") {
      throw new HttpsError("failed-precondition", "Payments cannot be added to a void sale.");
    }
    receiptNumber = officialSalesDocumentNumber(
      sale.branchCode || sale.branchId,
      "RCT",
      new Date(),
      paymentRef.id,
    );
    const currentBalance = money(Number(sale.balanceDue ?? 0));
    if (amount > currentBalance) {
      throw new HttpsError("invalid-argument", `Only ${currentBalance.toFixed(2)} remains due on this invoice.`);
    }
    const amountPaid = money(Number(sale.amountPaid ?? 0) + amount);
    balanceDue = money(Number(sale.totalAmount ?? 0) - amountPaid);
    paymentStatus = balanceDue > 0 ? "partPaid" : "paid";
    transaction.update(saleRef, {
      amountPaid,
      balanceDue,
      paymentStatus,
      receiptNumber,
      paymentMethod,
      paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
      paymentHistory: FieldValue.arrayUnion({
        paymentId: paymentRef.id,
        receiptNumber,
        amount,
        at: new Date().toISOString(),
        method: paymentMethod,
        paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
        recordedBy: actor.id,
      }),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
      updatedByEmail: actor.email,
      updatedByName: actor.displayName,
    });
    transaction.set(paymentRef, {
      organizationId,
      branchId: sale.branchId,
      referenceNumber: receiptNumber,
      receiptNumber,
      sourceType: "posSale",
      sourceId: saleId,
      sourceReference: sale.referenceNumber,
      payerName: sale.customerName ?? "Walk-in customer",
      revenueCategory: "other",
      revenueOwnerId: actor.id,
      revenueOwnerName: actor.displayName,
      amount,
      at: new Date().toISOString().slice(0, 10),
      method: paymentMethod,
      paymentReference: typeof request.data?.paymentReference === "string" ? request.data.paymentReference.trim().slice(0, 160) : "",
      note: `POS payment for ${sale.invoiceNumber ?? sale.referenceNumber}`,
      verificationStatus: "verified",
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedBy: actor.id,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdByName: actor.displayName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
      updatedByEmail: actor.email,
      updatedByName: actor.displayName,
      isDeleted: false,
    });
  });

  return { ok: true, receiptNumber, balanceDue, paymentStatus };
});

function inventoryReference(prefix: string, id: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 5).toUpperCase()}`;
}

function inventoryTraceId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export const createInventoryPurchaseOrder = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const branchId = requireString(request.data?.branchId, "branchId");
    const supplierId = requireString(request.data?.supplierId, "supplierId");
    const installationProjectId =
      typeof request.data?.installationProjectId === "string"
        ? request.data.installationProjectId.trim()
        : "";
    const installationProjectName =
      typeof request.data?.installationProjectName === "string"
        ? request.data.installationProjectName.trim().slice(0, 180)
        : "";
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (
      !hasActorPermission(actor, "inventory.procure") ||
      !canActorAccessBranch(actor, branchId)
    )
      throw new HttpsError(
        "permission-denied",
        "You cannot create purchase orders for this branch.",
      );
    const inputLines: unknown[] = Array.isArray(request.data?.lines)
      ? request.data.lines
      : [];
    if (!inputLines.length || inputLines.length > 50)
      throw new HttpsError(
        "invalid-argument",
        "A purchase order requires 1 to 50 lines.",
      );
    const normalizedLines = inputLines.map((line: unknown) => {
      const record =
        typeof line === "object" && line
          ? (line as Record<string, unknown>)
          : {};
      return {
        offeringId: requireString(record.offeringId, "offeringId"),
        quantity: requireNumber(record.quantity, "quantity"),
        unitCost: requireNumber(record.unitCost, "unitCost"),
      };
    });
    if (normalizedLines.some((line) => line.quantity <= 0 || line.unitCost < 0))
      throw new HttpsError(
        "invalid-argument",
        "Purchase quantities must be positive and costs cannot be negative.",
      );
    const [supplierSnapshot, ...offeringSnapshots] = await db.getAll(
      db.doc(
        `organizations/${organizationId}/inventorySuppliers/${supplierId}`,
      ),
      ...normalizedLines.map((line) =>
        db.doc(`organizations/${organizationId}/offerings/${line.offeringId}`),
      ),
    );
    if (
      !supplierSnapshot.exists ||
      supplierSnapshot.data()?.branchId !== branchId ||
      supplierSnapshot.data()?.status !== "active"
    )
      throw new HttpsError(
        "failed-precondition",
        "Select an active supplier in this branch.",
      );
    const lines = normalizedLines.map((line, index) => {
      const offering = offeringSnapshots[index].data();
      if (
        !offeringSnapshots[index].exists ||
        !offering?.brandId
      )
        throw new HttpsError(
          "failed-precondition",
          "Every purchase line must reference an active branded item.",
        );
      return {
        ...line,
        offeringName: offering.name ?? "Inventory item",
        brandId: offering.brandId,
        brandName: offering.brandName ?? "",
        sku: offering.sku ?? "",
        receivedQuantity: 0,
      };
    });
    const subtotal = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitCost,
      0,
    );
    const taxAmount = Math.max(0, Number(request.data?.taxAmount ?? 0));
    const totalAmount = subtotal + taxAmount;
    if (!Number.isFinite(totalAmount))
      throw new HttpsError("invalid-argument", "Enter a valid tax amount.");
    const hasPaymentArrangement = ["paid", "credit", "partPaid"].includes(
      request.data?.paymentArrangement,
    );
    const paymentArrangement = hasPaymentArrangement
      ? String(request.data.paymentArrangement)
      : "credit";
    const requestedAmountPaid = Math.max(
      0,
      Number(request.data?.amountPaid ?? 0),
    );
    const amountPaid =
      paymentArrangement === "paid"
        ? totalAmount
        : paymentArrangement === "credit"
          ? 0
          : requestedAmountPaid;
    if (!Number.isFinite(amountPaid) || amountPaid > totalAmount)
      throw new HttpsError(
        "invalid-argument",
        "Amount paid cannot exceed the purchase order total.",
      );
    if (
      paymentArrangement === "partPaid" &&
      (amountPaid <= 0 || amountPaid >= totalAmount)
    )
      throw new HttpsError(
        "invalid-argument",
        "A part payment must be greater than zero and less than the order total.",
      );
    const paymentMethod =
      typeof request.data?.paymentMethod === "string"
        ? request.data.paymentMethod
        : "";
    if (
      amountPaid > 0 &&
      !["cash", "bankTransfer", "card", "cheque", "other"].includes(
        paymentMethod,
      )
    )
      throw new HttpsError(
        "invalid-argument",
        "Select how the supplier was paid.",
      );
    const paymentDueAt = request.data?.paymentDueAt
      ? new Date(String(request.data.paymentDueAt))
      : null;
    if (
      amountPaid < totalAmount &&
      hasPaymentArrangement &&
      (!paymentDueAt || Number.isNaN(paymentDueAt.getTime()))
    )
      throw new HttpsError(
        "invalid-argument",
        "A valid payment due date is required when money remains owing.",
      );
    const balanceDue = Math.max(0, totalAmount - amountPaid);
    const paymentStatus =
      balanceDue === 0 ? "paid" : amountPaid > 0 ? "partPaid" : "unpaid";
    const ref = db
      .collection(`organizations/${organizationId}/inventoryPurchaseOrders`)
      .doc();
    const referenceNumber = inventoryReference("PO", ref.id);
    await ref.set({
      organizationId,
      branchId,
      referenceNumber,
      supplierId,
      supplierName: supplierSnapshot.data()?.name ?? "Supplier",
      installationProjectId,
      installationProjectName,
      lines,
      subtotal,
      taxAmount,
      totalAmount,
      paymentArrangement,
      paymentStatus,
      amountPaid,
      balanceDue,
      paymentMethod,
      paymentReference:
        typeof request.data?.paymentReference === "string"
          ? request.data.paymentReference.trim()
          : "",
      paymentDueAt: balanceDue > 0 ? paymentDueAt : null,
      lastPaymentAt: amountPaid > 0 ? FieldValue.serverTimestamp() : null,
      expectedAt: request.data?.expectedAt
        ? new Date(String(request.data.expectedAt))
        : null,
      approvalStatus: "pendingApproval",
      receivingStatus: "notReceived",
      notes:
        typeof request.data?.notes === "string"
          ? request.data.notes.trim()
          : "",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdByName: actor.displayName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
      isDeleted: false,
    });
    return { id: ref.id, referenceNumber };
  },
);

export const recordInventoryPurchaseOrderPayment = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const purchaseOrderId = requireString(
      request.data?.purchaseOrderId,
      "purchaseOrderId",
    );
    const amount = requireNumber(request.data?.amount, "amount");
    const paymentMethod = requireString(
      request.data?.paymentMethod,
      "paymentMethod",
    );
    if (
      amount <= 0 ||
      !["cash", "bankTransfer", "card", "cheque", "other"].includes(
        paymentMethod,
      )
    )
      throw new HttpsError(
        "invalid-argument",
        "Enter a positive payment and select a valid payment method.",
      );
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasAnyActorPermission(actor, ["inventory.procure", "finance.update"]))
      throw new HttpsError(
        "permission-denied",
        "You cannot record supplier payments.",
      );
    const orderRef = db.doc(
      `organizations/${organizationId}/inventoryPurchaseOrders/${purchaseOrderId}`,
    );
    const paymentRef = orderRef.collection("payments").doc();
    let result = {
      amountPaid: 0,
      balanceDue: 0,
      paymentStatus: "unpaid" as "unpaid" | "partPaid" | "paid",
    };
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      const order = snapshot.data();
      if (!snapshot.exists || !canActorAccessBranch(actor, order?.branchId))
        throw new HttpsError("not-found", "Purchase order was not found.");
      if (["rejected", "cancelled"].includes(order?.approvalStatus))
        throw new HttpsError(
          "failed-precondition",
          "Payments cannot be added to a rejected or cancelled order.",
        );
      const totalAmount = Number(order?.totalAmount ?? 0);
      const currentPaid = Number(order?.amountPaid ?? 0);
      const nextPaid = currentPaid + amount;
      if (nextPaid > totalAmount)
        throw new HttpsError(
          "failed-precondition",
          `Only ${Math.max(0, totalAmount - currentPaid)} remains owing on this order.`,
        );
      const balanceDue = Math.max(0, totalAmount - nextPaid);
      const paymentStatus = balanceDue === 0 ? "paid" : "partPaid";
      const paidAt = request.data?.paidAt
        ? new Date(String(request.data.paidAt))
        : new Date();
      if (Number.isNaN(paidAt.getTime()))
        throw new HttpsError("invalid-argument", "Enter a valid payment date.");
      transaction.update(orderRef, {
        amountPaid: nextPaid,
        balanceDue,
        paymentStatus,
        lastPaymentAt: paidAt,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
      transaction.set(paymentRef, {
        organizationId,
        branchId: order?.branchId,
        purchaseOrderId,
        amount,
        paymentMethod,
        paymentReference:
          typeof request.data?.paymentReference === "string"
            ? request.data.paymentReference.trim()
            : "",
        paidAt,
        notes:
          typeof request.data?.notes === "string"
            ? request.data.notes.trim()
            : "",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByEmail: actor.email,
        createdByName: actor.displayName,
      });
      result = { amountPaid: nextPaid, balanceDue, paymentStatus };
    });
    return { ok: true, ...result };
  },
);

export const decideInventoryApproval = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const entityType = requireString(request.data?.entityType, "entityType");
    const entityId = requireString(request.data?.entityId, "entityId");
    const decision = requireString(request.data?.decision, "decision");
    if (
      !["approved", "rejected"].includes(decision) ||
      !["purchaseOrder", "stockCount"].includes(entityType)
    )
      throw new HttpsError(
        "invalid-argument",
        "Unsupported approval decision.",
      );
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasActorPermission(actor, "inventory.approve"))
      throw new HttpsError(
        "permission-denied",
        "You do not have inventory approval permission.",
      );
    const collectionName =
      entityType === "purchaseOrder"
        ? "inventoryPurchaseOrders"
        : "inventoryStockCounts";
    const ref = db.doc(
      `organizations/${organizationId}/${collectionName}/${entityId}`,
    );
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || !canActorAccessBranch(actor, data?.branchId))
        throw new HttpsError("not-found", "Approval record was not found.");
      if (data?.approvalStatus !== "pendingApproval")
        throw new HttpsError(
          "failed-precondition",
          "This record is not awaiting approval.",
        );
      if (data?.createdBy === actor.id)
        throw new HttpsError(
          "failed-precondition",
          "The creator cannot approve their own record.",
        );
      transaction.update(ref, {
        approvalStatus: decision,
        approvedAt:
          decision === "approved" ? FieldValue.serverTimestamp() : null,
        approvedBy: decision === "approved" ? actor.id : "",
        rejectedAt:
          decision === "rejected" ? FieldValue.serverTimestamp() : null,
        rejectedBy: decision === "rejected" ? actor.id : "",
        rejectionReason:
          decision === "rejected"
            ? requireString(request.data?.reason, "reason")
            : "",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
    });
    return { ok: true };
  },
);

export const receiveInventoryPurchaseOrderLine = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const purchaseOrderId = requireString(
      request.data?.purchaseOrderId,
      "purchaseOrderId",
    );
    const locationId = requireString(request.data?.locationId, "locationId");
    const lineIndex = requireNumber(request.data?.lineIndex, "lineIndex");
    const quantity = requireNumber(request.data?.quantity, "quantity");
    if (
      !Number.isInteger(lineIndex) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    )
      throw new HttpsError(
        "invalid-argument",
        "Line and quantity must be positive whole numbers.",
      );
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasActorPermission(actor, "inventory.receive"))
      throw new HttpsError(
        "permission-denied",
        "You cannot receive inventory.",
      );
    const poRef = db.doc(
      `organizations/${organizationId}/inventoryPurchaseOrders/${purchaseOrderId}`,
    );
    const poBefore = await poRef.get();
    const poData = poBefore.data();
    const line = Array.isArray(poData?.lines)
      ? (poData.lines[lineIndex] as DocumentData | undefined)
      : undefined;
    if (
      !poBefore.exists ||
      !line ||
      poData?.approvalStatus !== "approved" ||
      !canActorAccessBranch(actor, poData.branchId)
    )
      throw new HttpsError(
        "failed-precondition",
        "Approved purchase order line was not found.",
      );
    const offeringId = requireString(line.offeringId, "offeringId");
    const offeringRef = db.doc(
      `organizations/${organizationId}/offerings/${offeringId}`,
    );
    const locationRef = db.doc(
      `organizations/${organizationId}/inventoryLocations/${locationId}`,
    );
    const locationBranchRef = db.doc(
      `organizations/${organizationId}/branches/${locationId}`,
    );
    const balanceRef = db.doc(
      `organizations/${organizationId}/inventoryBalances/${offeringId}_${locationId}`,
    );
    const movementRef = db
      .collection(`organizations/${organizationId}/inventoryMovements`)
      .doc();
    const offeringBefore = await offeringRef.get();
    const trackingMode =
      offeringBefore.data()?.trackingMode === "serial"
        ? "serial"
        : offeringBefore.data()?.trackingMode === "batch"
          ? "batch"
          : "none";
    const batchNumber =
      typeof request.data?.batchNumber === "string"
        ? request.data.batchNumber.trim()
        : "";
    const serialNumbers = Array.isArray(request.data?.serialNumbers)
      ? Array.from(
          new Set(
            request.data.serialNumbers
              .filter(
                (value: unknown): value is string =>
                  typeof value === "string" && Boolean(value.trim()),
              )
              .map((value: string) => value.trim()),
          ),
        )
      : [];
    if (trackingMode === "batch" && !batchNumber)
      throw new HttpsError("invalid-argument", "Batch number is required.");
    if (
      trackingMode === "serial" &&
      serialNumbers.length > 0 &&
      serialNumbers.length !== quantity
    )
      throw new HttpsError(
        "invalid-argument",
        "When serial numbers are provided, enter one for every received unit.",
      );
    const lotRef =
      trackingMode === "batch"
        ? db.doc(
            `organizations/${organizationId}/inventoryLots/${inventoryTraceId(`${offeringId}|${batchNumber}|${locationId}`)}`,
          )
        : null;
    const serialRefs = serialNumbers.map((serial) =>
      db.doc(
        `organizations/${organizationId}/inventorySerials/${inventoryTraceId(`${offeringId}|${serial}`)}`,
      ),
    );
    await db.runTransaction(async (transaction) => {
      const [
        poSnapshot,
        offeringSnapshot,
        locationSnapshot,
        locationBranchSnapshot,
        balanceSnapshot,
        lotSnapshot,
      ] = await Promise.all([
        transaction.get(poRef),
        transaction.get(offeringRef),
        transaction.get(locationRef),
        transaction.get(locationBranchRef),
        transaction.get(balanceRef),
        lotRef ? transaction.get(lotRef) : null,
      ]);
      const serialSnapshots = await Promise.all(
        serialRefs.map((ref) => transaction.get(ref)),
      );
      const currentPo = poSnapshot.data() ?? {};
      const lines = Array.isArray(currentPo.lines)
        ? ([...currentPo.lines] as DocumentData[])
        : [];
      const currentLine = lines[lineIndex];
      if (currentPo.approvalStatus !== "approved" || !currentLine)
        throw new HttpsError(
          "failed-precondition",
          "Purchase order is no longer receivable.",
        );
      const outstanding =
        Number(currentLine.quantity ?? 0) -
        Number(currentLine.receivedQuantity ?? 0);
      if (quantity > outstanding)
        throw new HttpsError(
          "failed-precondition",
          `Only ${outstanding} units remain on this line.`,
        );
      const offering = offeringSnapshot.data() ?? {};
      const location = resolveStockLocation(
        locationBranchSnapshot,
        locationSnapshot,
      );
      if (
        !offeringSnapshot.exists ||
        !location ||
        location.branchId !== currentPo.branchId
      )
        throw new HttpsError(
          "failed-precondition",
          "Item or receiving location is invalid.",
        );
      if (serialSnapshots.some((snapshot) => snapshot.exists))
        throw new HttpsError(
          "already-exists",
          "One or more serial numbers already exist.",
        );
      const common = {
        organizationId,
        branchId: currentPo.branchId,
        brandId: offering.brandId,
        brandName: offering.brandName ?? "",
        offeringId,
        offeringName: offering.name ?? "Inventory item",
        sku: offering.sku ?? "",
        locationId,
        locationName: location.name ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      };
      transaction.set(
        balanceRef,
        {
          ...common,
          quantityOnHand:
            Number(balanceSnapshot.data()?.quantityOnHand ?? 0) + quantity,
          quantityReserved: Number(
            balanceSnapshot.data()?.quantityReserved ?? 0,
          ),
        },
        { merge: true },
      );
      transaction.update(offeringRef, {
        stockQuantity: FieldValue.increment(quantity),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
      if (lotRef)
        transaction.set(
          lotRef,
          {
            ...common,
            batchNumber,
            expiryDate: request.data?.expiryDate
              ? new Date(String(request.data.expiryDate))
              : null,
            quantityOnHand:
              Number(lotSnapshot?.data()?.quantityOnHand ?? 0) + quantity,
            quantityReserved: Number(
              lotSnapshot?.data()?.quantityReserved ?? 0,
            ),
          },
          { merge: true },
        );
      serialRefs.forEach((ref, index) =>
        transaction.set(ref, {
          ...common,
          serialNumber: serialNumbers[index],
          status: "available",
        }),
      );
      transaction.set(movementRef, {
        ...common,
        movementType: "receipt",
        quantity,
        batchNumber,
        serialNumbers,
        purchaseOrderId,
        referenceNumber: inventoryReference("MOV", movementRef.id),
        externalReference: currentPo.referenceNumber,
        occurredAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByEmail: actor.email,
        createdByName: actor.displayName,
        isDeleted: false,
      });
      currentLine.receivedQuantity =
        Number(currentLine.receivedQuantity ?? 0) + quantity;
      lines[lineIndex] = currentLine;
      const allReceived = lines.every(
        (item) =>
          Number(item.receivedQuantity ?? 0) >= Number(item.quantity ?? 0),
      );
      const anyReceived = lines.some(
        (item) => Number(item.receivedQuantity ?? 0) > 0,
      );
      transaction.update(poRef, {
        lines,
        receivingStatus: allReceived
          ? "received"
          : anyReceived
            ? "partReceived"
            : "notReceived",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
    });
    return { ok: true, movementId: movementRef.id };
  },
);

export const createInventoryStockCount = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const branchId = requireString(request.data?.branchId, "branchId");
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (
      !hasActorPermission(actor, "inventory.count") ||
      !canActorAccessBranch(actor, branchId)
    )
      throw new HttpsError(
        "permission-denied",
        "You cannot submit stock counts for this branch.",
      );
    const inputLines: unknown[] = Array.isArray(request.data?.lines)
      ? request.data.lines
      : [];
    if (!inputLines.length || inputLines.length > 100)
      throw new HttpsError(
        "invalid-argument",
        "A count requires 1 to 100 lines.",
      );
    const normalized = inputLines.map((line: unknown) => {
      const value =
        typeof line === "object" && line
          ? (line as Record<string, unknown>)
          : {};
      return {
        offeringId: requireString(value.offeringId, "offeringId"),
        locationId: requireString(value.locationId, "locationId"),
        actualQuantity: requireNumber(value.actualQuantity, "actualQuantity"),
        reason: typeof value.reason === "string" ? value.reason.trim() : "",
      };
    });
    if (normalized.some((line) => line.actualQuantity < 0))
      throw new HttpsError(
        "invalid-argument",
        "Actual quantities cannot be negative.",
      );
    const snapshots = await db.getAll(
      ...normalized.flatMap((line) => [
        db.doc(`organizations/${organizationId}/offerings/${line.offeringId}`),
        db.doc(
          `organizations/${organizationId}/inventoryLocations/${line.locationId}`,
        ),
        db.doc(`organizations/${organizationId}/branches/${line.locationId}`),
        db.doc(
          `organizations/${organizationId}/inventoryBalances/${line.offeringId}_${line.locationId}`,
        ),
      ]),
    );
    const lines = normalized.map((line, index) => {
      const offering = snapshots[index * 4].data() ?? {};
      const location = resolveStockLocation(
        snapshots[index * 4 + 2],
        snapshots[index * 4 + 1],
      );
      const balance = snapshots[index * 4 + 3].data() ?? {};
      if (
        !offering.brandId ||
        !location ||
        location.branchId !== branchId
      )
        throw new HttpsError(
          "failed-precondition",
          "Every count line must belong to this branch.",
        );
      if (offering.trackingMode === "batch")
        throw new HttpsError(
          "failed-precondition",
          `${offering.name ?? "This item"} is batch-controlled. Reconcile it through batch inventory movements.`,
        );
      const systemQuantity = Number(balance.quantityOnHand ?? 0);
      return {
        ...line,
        offeringName: offering.name ?? "Inventory item",
        brandId: offering.brandId ?? "",
        locationName: location.name ?? "",
        systemQuantity,
        variance: line.actualQuantity - systemQuantity,
      };
    });
    const ref = db
      .collection(`organizations/${organizationId}/inventoryStockCounts`)
      .doc();
    await ref.set({
      organizationId,
      branchId,
      referenceNumber: inventoryReference("COUNT", ref.id),
      name: requireString(request.data?.name, "name"),
      lines,
      approvalStatus: "pendingApproval",
      countStatus: "submitted",
      countedAt: new Date(),
      notes:
        typeof request.data?.notes === "string"
          ? request.data.notes.trim()
          : "",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.id,
      createdByEmail: actor.email,
      createdByName: actor.displayName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
      isDeleted: false,
    });
    return { id: ref.id };
  },
);

export const postInventoryStockCount = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const countId = requireString(request.data?.countId, "countId");
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasActorPermission(actor, "inventory.approve"))
      throw new HttpsError(
        "permission-denied",
        "You cannot post stock counts.",
      );
    const countRef = db.doc(
      `organizations/${organizationId}/inventoryStockCounts/${countId}`,
    );
    const before = await countRef.get();
    const data = before.data();
    if (
      !before.exists ||
      data?.approvalStatus !== "approved" ||
      data?.countStatus !== "submitted" ||
      !canActorAccessBranch(actor, data.branchId)
    )
      throw new HttpsError(
        "failed-precondition",
        "This count is not ready to post.",
      );
    const lines = Array.isArray(data.lines)
      ? (data.lines as DocumentData[])
      : [];
    const balanceRefs = lines.map((line) =>
      db.doc(
        `organizations/${organizationId}/inventoryBalances/${line.offeringId}_${line.locationId}`,
      ),
    );
    const offeringRefs = lines.map((line) =>
      db.doc(`organizations/${organizationId}/offerings/${line.offeringId}`),
    );
    await db.runTransaction(async (transaction) => {
      const countSnapshot = await transaction.get(countRef);
      const balanceSnapshots = await Promise.all(
        balanceRefs.map((ref) => transaction.get(ref)),
      );
      if (countSnapshot.data()?.countStatus !== "submitted")
        throw new HttpsError(
          "failed-precondition",
          "Count was already posted.",
        );
      lines.forEach((line, index) => {
        const current = Number(
          balanceSnapshots[index].data()?.quantityOnHand ?? 0,
        );
        const variance = Number(line.actualQuantity) - current;
        const reserved = Number(
          balanceSnapshots[index].data()?.quantityReserved ?? 0,
        );
        if (Number(line.actualQuantity) < reserved)
          throw new HttpsError(
            "failed-precondition",
            `${line.offeringName} actual stock is below its reserved quantity.`,
          );
        transaction.set(
          balanceRefs[index],
          {
            quantityOnHand: Number(line.actualQuantity),
            quantityReserved: reserved,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor.id,
          },
          { merge: true },
        );
        if (variance !== 0) {
          transaction.update(offeringRefs[index], {
            stockQuantity: FieldValue.increment(variance),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor.id,
          });
          const movementRef = db
            .collection(`organizations/${organizationId}/inventoryMovements`)
            .doc();
          transaction.set(movementRef, {
            organizationId,
            branchId: data.branchId,
            brandId: line.brandId,
            brandName: "",
            offeringId: line.offeringId,
            offeringName: line.offeringName,
            movementType: variance > 0 ? "adjustmentIn" : "adjustmentOut",
            quantity: Math.abs(variance),
            fromLocationId: variance < 0 ? line.locationId : "",
            fromLocationName: variance < 0 ? line.locationName : "",
            toLocationId: variance > 0 ? line.locationId : "",
            toLocationName: variance > 0 ? line.locationName : "",
            referenceNumber: inventoryReference("MOV", movementRef.id),
            externalReference: data.referenceNumber,
            notes: line.reason ?? "Stock count variance",
            occurredAt: new Date(),
            createdAt: FieldValue.serverTimestamp(),
            createdBy: actor.id,
            createdByName: actor.displayName,
            isDeleted: false,
          });
        }
      });
      transaction.update(countRef, {
        countStatus: "posted",
        postedAt: FieldValue.serverTimestamp(),
        postedBy: actor.id,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
    });
    return { ok: true };
  },
);

export const createInventoryReservation = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const branchId = requireString(request.data?.branchId, "branchId");
    const offeringId = requireString(request.data?.offeringId, "offeringId");
    const locationId = requireString(request.data?.locationId, "locationId");
    const quantity = requireNumber(request.data?.quantity, "quantity");
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new HttpsError(
        "invalid-argument",
        "Reservation quantity must be a positive whole number.",
      );
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (
      !hasActorPermission(actor, "inventory.reserve") ||
      !canActorAccessBranch(actor, branchId)
    )
      throw new HttpsError(
        "permission-denied",
        "You cannot reserve stock for this branch.",
      );
    const offeringRef = db.doc(
      `organizations/${organizationId}/offerings/${offeringId}`,
    );
    const locationRef = db.doc(
      `organizations/${organizationId}/inventoryLocations/${locationId}`,
    );
    const locationBranchRef = db.doc(
      `organizations/${organizationId}/branches/${locationId}`,
    );
    const balanceRef = db.doc(
      `organizations/${organizationId}/inventoryBalances/${offeringId}_${locationId}`,
    );
    const reservationRef = db
      .collection(`organizations/${organizationId}/inventoryReservations`)
      .doc();
    const offeringBefore = await offeringRef.get();
    const trackingMode =
      offeringBefore.data()?.trackingMode === "serial"
        ? "serial"
        : offeringBefore.data()?.trackingMode === "batch"
          ? "batch"
          : "none";
    const batchNumber =
      typeof request.data?.batchNumber === "string"
        ? request.data.batchNumber.trim()
        : "";
    const serialNumbers = Array.isArray(request.data?.serialNumbers)
      ? Array.from(
          new Set(
            request.data.serialNumbers
              .filter(
                (value: unknown): value is string =>
                  typeof value === "string" && Boolean(value.trim()),
              )
              .map((value: string) => value.trim()),
          ),
        )
      : [];
    if (trackingMode === "batch" && !batchNumber)
      throw new HttpsError(
        "invalid-argument",
        "Batch number is required for this reservation.",
      );
    if (
      trackingMode === "serial" &&
      serialNumbers.length > 0 &&
      serialNumbers.length !== quantity
    )
      throw new HttpsError(
        "invalid-argument",
        "When serial numbers are provided, enter one for every reserved unit.",
      );
    const lotRef =
      trackingMode === "batch"
        ? db.doc(
            `organizations/${organizationId}/inventoryLots/${inventoryTraceId(`${offeringId}|${batchNumber}|${locationId}`)}`,
          )
        : null;
    const serialRefs = serialNumbers.map((serial) =>
      db.doc(
        `organizations/${organizationId}/inventorySerials/${inventoryTraceId(`${offeringId}|${serial}`)}`,
      ),
    );
    await db.runTransaction(async (transaction) => {
      const [
        offeringSnapshot,
        locationSnapshot,
        locationBranchSnapshot,
        balanceSnapshot,
        lotSnapshot,
      ] = await Promise.all([
        transaction.get(offeringRef),
        transaction.get(locationRef),
        transaction.get(locationBranchRef),
        transaction.get(balanceRef),
        lotRef ? transaction.get(lotRef) : null,
      ]);
      const serialSnapshots = await Promise.all(
        serialRefs.map((ref) => transaction.get(ref)),
      );
      const offering = offeringSnapshot.data() ?? {};
      const location = resolveStockLocation(
        locationBranchSnapshot,
        locationSnapshot,
      );
      const onHand = Number(balanceSnapshot.data()?.quantityOnHand ?? 0);
      const reserved = Number(balanceSnapshot.data()?.quantityReserved ?? 0);
      if (
        !offering.brandId ||
        !location ||
        location.branchId !== branchId ||
        onHand - reserved < quantity
      )
        throw new HttpsError(
          "failed-precondition",
          `Only ${Math.max(0, onHand - reserved)} units are available to reserve.`,
        );
      if (lotRef) {
        const lotOnHand = Number(lotSnapshot?.data()?.quantityOnHand ?? 0);
        const lotReserved = Number(lotSnapshot?.data()?.quantityReserved ?? 0);
        if (lotOnHand - lotReserved < quantity)
          throw new HttpsError(
            "failed-precondition",
            `Batch ${batchNumber} does not have enough available stock.`,
          );
        transaction.set(
          lotRef,
          {
            quantityReserved: lotReserved + quantity,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      serialSnapshots.forEach((snapshot, index) => {
        if (
          !snapshot.exists ||
          snapshot.data()?.locationId !== locationId ||
          snapshot.data()?.status !== "available"
        )
          throw new HttpsError(
            "failed-precondition",
            `Serial ${serialNumbers[index]} is not available.`,
          );
        transaction.update(serialRefs[index], {
          status: "reserved",
          reservationId: reservationRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.set(
        balanceRef,
        {
          quantityReserved: reserved + quantity,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.id,
        },
        { merge: true },
      );
      transaction.set(reservationRef, {
        organizationId,
        branchId,
        referenceNumber: inventoryReference("RES", reservationRef.id),
        brandId: offering.brandId,
        brandName: offering.brandName ?? "",
        offeringId,
        offeringName: offering.name ?? "Inventory item",
        locationId,
        locationName: location.name ?? "",
        quantity,
        batchNumber,
        serialNumbers,
        relatedEntityType: request.data?.relatedEntityType ?? "other",
        relatedEntityId:
          typeof request.data?.relatedEntityId === "string"
            ? request.data.relatedEntityId.trim()
            : "",
        relatedEntityName:
          typeof request.data?.relatedEntityName === "string"
            ? request.data.relatedEntityName.trim()
            : "",
        expiresAt: request.data?.expiresAt
          ? new Date(String(request.data.expiresAt))
          : null,
        notes:
          typeof request.data?.notes === "string"
            ? request.data.notes.trim()
            : "",
        reservationStatus: "active",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.id,
        createdByName: actor.displayName,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
        isDeleted: false,
      });
    });
    return { id: reservationRef.id };
  },
);

export const closeInventoryReservation = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Authentication is required.");
    const organizationId = requireString(
      request.data?.organizationId,
      "organizationId",
    );
    const reservationId = requireString(
      request.data?.reservationId,
      "reservationId",
    );
    const action = requireString(request.data?.action, "action");
    if (!["release", "fulfill"].includes(action))
      throw new HttpsError(
        "invalid-argument",
        "Action must be release or fulfill.",
      );
    const actor = await getActiveMember(request.auth.uid, organizationId);
    if (!hasActorPermission(actor, "inventory.reserve"))
      throw new HttpsError(
        "permission-denied",
        "You cannot close reservations.",
      );
    const reservationRef = db.doc(
      `organizations/${organizationId}/inventoryReservations/${reservationId}`,
    );
    const before = await reservationRef.get();
    const data = before.data();
    if (
      !before.exists ||
      data?.reservationStatus !== "active" ||
      !canActorAccessBranch(actor, data.branchId)
    )
      throw new HttpsError(
        "failed-precondition",
        "Active reservation was not found.",
      );
    const balanceRef = db.doc(
      `organizations/${organizationId}/inventoryBalances/${data.offeringId}_${data.locationId}`,
    );
    const offeringRef = db.doc(
      `organizations/${organizationId}/offerings/${data.offeringId}`,
    );
    const movementRef = db
      .collection(`organizations/${organizationId}/inventoryMovements`)
      .doc();
    const lotRef = data.batchNumber
      ? db.doc(
          `organizations/${organizationId}/inventoryLots/${inventoryTraceId(`${data.offeringId}|${data.batchNumber}|${data.locationId}`)}`,
        )
      : null;
    const reservationSerialNumbers = Array.isArray(data.serialNumbers)
      ? (data.serialNumbers as string[])
      : [];
    const serialRefs = reservationSerialNumbers.map((serial) =>
      db.doc(
        `organizations/${organizationId}/inventorySerials/${inventoryTraceId(`${data.offeringId}|${serial}`)}`,
      ),
    );
    await db.runTransaction(async (transaction) => {
      const [reservationSnapshot, balanceSnapshot, lotSnapshot] =
        await Promise.all([
          transaction.get(reservationRef),
          transaction.get(balanceRef),
          lotRef ? transaction.get(lotRef) : null,
        ]);
      const serialSnapshots = await Promise.all(
        serialRefs.map((ref) => transaction.get(ref)),
      );
      const reservation = reservationSnapshot.data() ?? {};
      if (reservation.reservationStatus !== "active")
        throw new HttpsError(
          "failed-precondition",
          "Reservation was already closed.",
        );
      const quantity = Number(reservation.quantity);
      const onHand = Number(balanceSnapshot.data()?.quantityOnHand ?? 0);
      const reserved = Number(balanceSnapshot.data()?.quantityReserved ?? 0);
      if (reserved < quantity || (action === "fulfill" && onHand < quantity))
        throw new HttpsError(
          "failed-precondition",
          "Reservation balance is inconsistent.",
        );
      if (lotRef) {
        const lotReserved = Number(lotSnapshot?.data()?.quantityReserved ?? 0);
        const lotOnHand = Number(lotSnapshot?.data()?.quantityOnHand ?? 0);
        if (lotReserved < quantity)
          throw new HttpsError(
            "failed-precondition",
            "Reserved batch balance is inconsistent.",
          );
        transaction.set(
          lotRef,
          {
            quantityReserved: lotReserved - quantity,
            quantityOnHand:
              action === "fulfill" ? lotOnHand - quantity : lotOnHand,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      serialSnapshots.forEach((snapshot, index) => {
        if (
          !snapshot.exists ||
          snapshot.data()?.reservationId !== reservationId
        )
          throw new HttpsError(
            "failed-precondition",
            `Serial reservation is inconsistent for ${reservationSerialNumbers[index]}.`,
          );
        transaction.update(serialRefs[index], {
          status: action === "fulfill" ? "issued" : "available",
          reservationId: "",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.set(
        balanceRef,
        {
          quantityReserved: reserved - quantity,
          quantityOnHand: action === "fulfill" ? onHand - quantity : onHand,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.id,
        },
        { merge: true },
      );
      if (action === "fulfill") {
        transaction.update(offeringRef, {
          stockQuantity: FieldValue.increment(-quantity),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.id,
        });
        transaction.set(movementRef, {
          organizationId,
          branchId: reservation.branchId,
          brandId: reservation.brandId,
          brandName: reservation.brandName,
          offeringId: reservation.offeringId,
          offeringName: reservation.offeringName,
          movementType: "issue",
          movementPurpose:
            reservation.relatedEntityType === "deal"
              ? "sale"
              : reservation.relatedEntityType === "project" ||
                  reservation.relatedEntityType === "workOrder"
                ? "project"
                : "other",
          quantity,
          batchNumber: reservation.batchNumber ?? "",
          serialNumbers: reservation.serialNumbers ?? [],
          fromLocationId: reservation.locationId,
          fromLocationName: reservation.locationName,
          reservationId,
          referenceNumber: inventoryReference("MOV", movementRef.id),
          externalReference:
            reservation.relatedEntityId || reservation.referenceNumber,
          occurredAt: new Date(),
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.id,
          createdByName: actor.displayName,
          isDeleted: false,
        });
      }
      transaction.update(reservationRef, {
        reservationStatus: action === "fulfill" ? "fulfilled" : "released",
        fulfilledAt: action === "fulfill" ? FieldValue.serverTimestamp() : null,
        releasedAt: action === "release" ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.id,
      });
    });
    return { ok: true };
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
