import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.app.created",
];
const OAUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;

export const googleCalendarStateCookie = "vlingo_google_calendar_oauth";

interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
}

interface OAuthState {
  expiresAt: number;
  nonce: string;
  organizationId: string;
  uid: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export interface CalendarConnection {
  branchId?: string;
  calendarId: string;
  calendarName: string;
  encryptedRefreshToken: string;
  googleEmail: string;
  organizationId: string;
  status: "active" | "disconnected";
  userId: string;
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} must be configured.`);
  }
  return value;
}

export function googleCalendarConfig(): GoogleCalendarConfig {
  const tokenEncryptionKey = requireEnvironment("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY");
  if (tokenEncryptionKey.length < 32) {
    throw new Error("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }

  return {
    clientId: requireEnvironment("GOOGLE_CALENDAR_CLIENT_ID"),
    clientSecret: requireEnvironment("GOOGLE_CALENDAR_CLIENT_SECRET"),
    redirectUri: requireEnvironment("GOOGLE_CALENDAR_REDIRECT_URI"),
    tokenEncryptionKey,
  };
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleToken(token: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(value: string, secret: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("The stored Google Calendar credential is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function signStatePayload(payload: string, secret: string) {
  return createHmac("sha256", keyFromSecret(secret)).update(payload).digest("base64url");
}

export function createGoogleOAuthState(organizationId: string, uid: string) {
  const config = googleCalendarConfig();
  const state: OAuthState = {
    expiresAt: Date.now() + OAUTH_STATE_LIFETIME_MS,
    nonce: randomBytes(24).toString("base64url"),
    organizationId,
    uid,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return {
    cookieValue: state.nonce,
    state: `${payload}.${signStatePayload(payload, config.tokenEncryptionKey)}`,
  };
}

export function verifyGoogleOAuthState(value: string, cookieValue: string | undefined) {
  const config = googleCalendarConfig();
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    throw new Error("The Google authorization state is invalid.");
  }
  const expected = signStatePayload(payload, config.tokenEncryptionKey);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("The Google authorization state could not be verified.");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  if (!state.uid || !state.organizationId || !state.nonce || state.expiresAt < Date.now()) {
    throw new Error("The Google authorization request has expired. Start the connection again.");
  }
  if (!cookieValue || cookieValue !== state.nonce) {
    throw new Error("The Google authorization request does not match this browser session.");
  }
  return state;
}

export function googleAuthorizationUrl(state: string) {
  const config = googleCalendarConfig();
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: config.clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function googleJson<T>(url: string, init: RequestInit, action: string): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const nestedError = typeof payload.error === "object" && payload.error ? payload.error as Record<string, unknown> : null;
    const message = String(nestedError?.message ?? payload.error_description ?? payload.error ?? `${action} failed.`);
    throw new Error(`${action}: ${message}`);
  }
  return payload as T;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const config = googleCalendarConfig();
  return googleJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  }, "Google authorization code exchange");
}

export async function refreshGoogleAccessToken(encryptedRefreshToken: string) {
  const config = googleCalendarConfig();
  const refreshToken = decryptGoogleToken(encryptedRefreshToken, config.tokenEncryptionKey);
  const token = await googleJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  }, "Google access token refresh");
  return token.access_token;
}

export async function googleAccountEmail(accessToken: string) {
  const profile = await googleJson<{ email?: string }>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, "Google account lookup");
  if (!profile.email) {
    throw new Error("Google did not return an email address for this account.");
  }
  return profile.email;
}

export async function createVlingoCalendar(accessToken: string) {
  return googleJson<{ id: string; summary?: string }>(`${GOOGLE_CALENDAR_API}/calendars`, {
    body: JSON.stringify({ summary: "Vlingo CRM Tasks", timeZone: "Africa/Lagos" }),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  }, "Google Calendar creation");
}

export async function deleteVlingoCalendar(accessToken: string, calendarId: string) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Unable to remove the Vlingo CRM calendar from Google.");
  }
}

export async function revokeGoogleToken(refreshToken: string) {
  await fetch(GOOGLE_REVOKE_URL, {
    body: new URLSearchParams({ token: refreshToken }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

export async function authenticateCalendarRequest(request: Request, organizationId: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    throw new CalendarRequestError(401, "Authentication is required.");
  }
  const decoded = await adminAuth.verifyIdToken(token);
  const memberSnapshot = await adminDb.doc(`organizations/${organizationId}/members/${decoded.uid}`).get();
  const member = memberSnapshot.data();
  if (!memberSnapshot.exists || member?.status !== "active") {
    throw new CalendarRequestError(403, "You do not have access to this organization.");
  }
  return { member: member as DocumentData, uid: decoded.uid };
}

export class CalendarRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function calendarConnectionRef(organizationId: string, uid: string) {
  return adminDb.doc(`organizations/${organizationId}/calendarConnections/${uid}`);
}

export async function readCalendarConnection(organizationId: string, uid: string) {
  const snapshot = await calendarConnectionRef(organizationId, uid).get();
  return snapshot.exists ? snapshot.data() as CalendarConnection : null;
}

export async function saveCalendarConnection(connection: CalendarConnection) {
  await calendarConnectionRef(connection.organizationId, connection.userId).set({
    ...connection,
    connectedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function encryptedRefreshToken(refreshToken: string) {
  return encryptGoogleToken(refreshToken, googleCalendarConfig().tokenEncryptionKey);
}

export function decryptedRefreshToken(value: string) {
  return decryptGoogleToken(value, googleCalendarConfig().tokenEncryptionKey);
}

function taskEventId(organizationId: string, taskId: string) {
  return createHash("sha256").update(`vlingo:${organizationId}:${taskId}`).digest("hex").slice(0, 40);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function taskEvent(taskId: string, task: DocumentData, organizationId: string) {
  const dueAt = task.dueAt instanceof Date
    ? task.dueAt.toISOString()
    : typeof task.dueAt?.toDate === "function"
      ? task.dueAt.toDate().toISOString()
      : String(task.dueAt ?? "");
  const titlePrefix = task.status === "completed" ? "[Completed] " : "";
  const details = [
    String(task.description ?? "").trim(),
    task.expectedOutcome ? `Expected outcome: ${task.expectedOutcome}` : "",
    task.priority ? `Priority: ${task.priority}` : "",
    task.relatedEntityType && task.relatedEntityId ? `Related ${task.relatedEntityType}: ${task.relatedEntityId}` : "",
    `${(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/tasks/${taskId}`,
  ].filter(Boolean).join("\n\n");
  const reminder = Number(task.reminderMinutesBefore);
  const base = {
    description: details,
    id: taskEventId(organizationId, taskId),
    location: String(task.location ?? ""),
    reminders: Number.isFinite(reminder) && reminder >= 0
      ? { overrides: [{ method: "popup", minutes: Math.min(reminder, 40320) }], useDefault: false }
      : { useDefault: true },
    summary: `${titlePrefix}${String(task.title ?? "CRM task")}`,
  };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    return { ...base, end: { date: nextDate(dueAt) }, start: { date: dueAt } };
  }
  const start = new Date(dueAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const duration = Math.max(15, Number(task.estimatedDurationMinutes) || 30);
  return {
    ...base,
    end: { dateTime: new Date(start.getTime() + duration * 60_000).toISOString(), timeZone: "Africa/Lagos" },
    start: { dateTime: start.toISOString(), timeZone: "Africa/Lagos" },
  };
}

export async function upsertGoogleTaskEvent(accessToken: string, calendarId: string, organizationId: string, taskId: string, task: DocumentData) {
  const event = taskEvent(taskId, task, organizationId);
  if (!event) {
    return false;
  }
  const calendarPath = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const insert = await fetch(calendarPath, {
    body: JSON.stringify(event),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (insert.ok) {
    return true;
  }
  if (insert.status !== 409) {
    const payload = await insert.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Google event sync failed: ${payload.error?.message || insert.statusText}`);
  }
  await googleJson(`${calendarPath}/${event.id}`, {
    body: JSON.stringify(event),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "PUT",
  }, "Google event update");
  return true;
}

export async function syncExistingGoogleTasks(organizationId: string, uid: string, accessToken: string, calendarId: string) {
  const snapshot = await adminDb.collection(`organizations/${organizationId}/tasks`)
    .where("assignedTo", "==", uid)
    .limit(200)
    .get();
  const tasks = snapshot.docs.filter((item) => {
    const task = item.data();
    return task.isDeleted !== true && task.status !== "cancelled" && Boolean(task.dueAt);
  });
  const results = await Promise.allSettled(tasks.map((item) => upsertGoogleTaskEvent(
    accessToken,
    calendarId,
    organizationId,
    item.id,
    item.data(),
  )));
  return results.filter((result) => result.status === "fulfilled").length;
}
