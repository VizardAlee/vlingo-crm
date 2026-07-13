import { createDecipheriv, createHash } from "node:crypto";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface CalendarConnection extends DocumentData {
  calendarId: string;
  encryptedRefreshToken: string;
  status: string;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is not configured for Google Calendar task sync.`);
  }
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(requiredEnvironment("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY")).digest();
}

function decryptRefreshToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored Google Calendar credential is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function refreshAccessToken(connection: CalendarConnection) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: requiredEnvironment("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: requiredEnvironment("GOOGLE_CALENDAR_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: decryptRefreshToken(connection.encryptedRefreshToken),
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Google access token refresh failed.");
  }
  return payload.access_token;
}

function eventId(organizationId: string, taskId: string) {
  return createHash("sha256").update(`vlingo:${organizationId}:${taskId}`).digest("hex").slice(0, 40);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dueAtValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  return "";
}

function googleEvent(organizationId: string, taskId: string, task: DocumentData) {
  const dueAt = dueAtValue(task.dueAt);
  if (!dueAt) {
    return null;
  }
  const appBaseUrl = (process.env.APP_BASE_URL || "https://vlingo-crm.svoltnigeria.com").replace(/\/$/, "");
  const description = [
    String(task.description ?? "").trim(),
    task.expectedOutcome ? `Expected outcome: ${task.expectedOutcome}` : "",
    task.priority ? `Priority: ${task.priority}` : "",
    task.assignedToName || task.assignedToEmail ? `Assigned to: ${task.assignedToName || task.assignedToEmail}` : "",
    task.relatedEntityType && task.relatedEntityId ? `Related ${task.relatedEntityType}: ${task.relatedEntityId}` : "",
    `${appBaseUrl}/tasks/${taskId}`,
  ].filter(Boolean).join("\n\n");
  const reminder = Number(task.reminderMinutesBefore);
  const base = {
    description,
    id: eventId(organizationId, taskId),
    location: String(task.location ?? ""),
    reminders: Number.isFinite(reminder) && reminder >= 0
      ? { overrides: [{ method: "popup", minutes: Math.min(reminder, 40320) }], useDefault: false }
      : { useDefault: true },
    summary: `${task.status === "completed" ? "[Completed] " : ""}${String(task.title ?? "CRM task")}`,
  };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    return { ...base, end: { date: nextDate(dueAt) }, start: { date: dueAt } };
  }
  const start = new Date(dueAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const durationMinutes = Math.max(15, Number(task.estimatedDurationMinutes) || 30);
  return {
    ...base,
    end: { dateTime: new Date(start.getTime() + durationMinutes * 60_000).toISOString(), timeZone: "Africa/Lagos" },
    start: { dateTime: start.toISOString(), timeZone: "Africa/Lagos" },
  };
}

async function connectionFor(organizationId: string, userId: string) {
  const snapshot = await getFirestore().doc(`organizations/${organizationId}/calendarConnections/${userId}`).get();
  const data = snapshot.data() as CalendarConnection | undefined;
  return snapshot.exists && data?.status === "active" && data.calendarId && data.encryptedRefreshToken ? data : null;
}

async function deleteEvent(organizationId: string, taskId: string, userId: string) {
  const connection = await connectionFor(organizationId, userId);
  if (!connection) {
    return;
  }
  const accessToken = await refreshAccessToken(connection);
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(connection.calendarId)}/events/${eventId(organizationId, taskId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, method: "DELETE" },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google event removal failed with status ${response.status}.`);
  }
}

async function upsertEvent(organizationId: string, taskId: string, userId: string, task: DocumentData) {
  const event = googleEvent(organizationId, taskId, task);
  const connection = await connectionFor(organizationId, userId);
  if (!event || !connection) {
    return;
  }
  const accessToken = await refreshAccessToken(connection);
  const eventsUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(connection.calendarId)}/events`;
  const insert = await fetch(eventsUrl, {
    body: JSON.stringify(event),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (insert.ok) {
    return;
  }
  if (insert.status !== 409) {
    const payload = await insert.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `Google event creation failed with status ${insert.status}.`);
  }
  const update = await fetch(`${eventsUrl}/${event.id}`, {
    body: JSON.stringify(event),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!update.ok) {
    const payload = await update.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `Google event update failed with status ${update.status}.`);
  }
}

function shouldHaveEvent(task: DocumentData | undefined) {
  return Boolean(task && task.isDeleted !== true && task.status !== "cancelled" && task.assignedTo && dueAtValue(task.dueAt));
}

export async function syncTaskToGoogleCalendar(
  organizationId: string,
  taskId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
) {
  const oldOwner = typeof before?.assignedTo === "string" ? before.assignedTo : "";
  const newOwner = typeof after?.assignedTo === "string" ? after.assignedTo : "";
  const removeOld = shouldHaveEvent(before) && (!shouldHaveEvent(after) || oldOwner !== newOwner);
  if (removeOld && oldOwner) {
    await deleteEvent(organizationId, taskId, oldOwner);
  }
  if (shouldHaveEvent(after) && newOwner) {
    await upsertEvent(organizationId, taskId, newOwner, after!);
  }
}
