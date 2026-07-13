import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type TaskRecord = Record<string, unknown> & { id: string };

function calendarSecret() {
  return process.env.CALENDAR_FEED_SECRET || "";
}

function appBaseUrl(request: Request) {
  return (process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function signFeed(organizationId: string, uid: string) {
  return createHmac("sha256", calendarSecret())
    .update(`${organizationId}.${uid}`)
    .digest("hex");
}

function validSignature(organizationId: string, uid: string, signature: string) {
  const expected = signFeed(organizationId, uid);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function asDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function isDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateValue(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function dateTimeValue(date: Date) {
  return `${dateValue(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeText(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string) {
  if (line.length <= 74) {
    return line;
  }

  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function eventDescription(task: TaskRecord, taskUrl: string) {
  return [
    task.description ? `Description: ${task.description}` : "",
    task.expectedOutcome ? `Expected outcome: ${task.expectedOutcome}` : "",
    task.priority ? `Priority: ${task.priority}` : "",
    task.status ? `Status: ${task.status}` : "",
    task.assignedToName || task.assignedToEmail ? `Assigned to: ${[task.assignedToName, task.assignedToEmail].filter(Boolean).join(" <")}${task.assignedToEmail ? ">" : ""}` : "",
    task.relatedEntityType || task.relatedEntityId ? `Related record: ${[task.relatedEntityType, task.relatedEntityId].filter(Boolean).join(" ")}` : "",
    task.referenceNumber ? `Reference: ${task.referenceNumber}` : "",
    `CRM link: ${taskUrl}`,
  ].filter(Boolean).join("\n");
}

function taskEvent(task: TaskRecord, request: Request, organizationId: string) {
  const dueDate = asDate(task.dueAt);
  if (!dueDate) {
    return [];
  }

  const taskUrl = `${appBaseUrl(request)}/tasks/${encodeURIComponent(task.id)}`;
  const createdDate = asDate(task.createdAt) ?? new Date();
  const updatedDate = asDate(task.updatedAt) ?? createdDate;
  const durationMinutes = Math.max(Number(task.estimatedDurationMinutes ?? 60) || 60, 15);
  const reminderMinutes = Math.max(Number(task.reminderMinutesBefore ?? 60) || 60, 0);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(`${organizationId}-${task.id}@vlingo-crm`)}`,
    `DTSTAMP:${dateTimeValue(updatedDate)}`,
    `CREATED:${dateTimeValue(createdDate)}`,
    `LAST-MODIFIED:${dateTimeValue(updatedDate)}`,
    `SUMMARY:${escapeText(task.title || "CRM task")}`,
    `DESCRIPTION:${escapeText(eventDescription(task, taskUrl))}`,
    task.location ? `LOCATION:${escapeText(task.location)}` : "",
    `URL:${escapeText(taskUrl)}`,
    `STATUS:${String(task.status) === "completed" ? "COMPLETED" : "CONFIRMED"}`,
  ].filter(Boolean);

  if (isDateOnly(task.dueAt)) {
    const end = new Date(dueDate);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${dateValue(dueDate)}`);
    lines.push(`DTEND;VALUE=DATE:${dateValue(end)}`);
  } else {
    const end = new Date(dueDate.getTime() + durationMinutes * 60_000);
    lines.push(`DTSTART:${dateTimeValue(dueDate)}`);
    lines.push(`DTEND:${dateTimeValue(end)}`);
  }

  if (reminderMinutes > 0) {
    lines.push("BEGIN:VALARM");
    lines.push(`TRIGGER:-PT${reminderMinutes}M`);
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeText(task.title || "CRM task reminder")}`);
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines;
}

export async function GET(request: Request) {
  if (calendarSecret().length < 32) {
    return NextResponse.json({ error: "Calendar feed is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("org") || "";
  const uid = url.searchParams.get("uid") || "";
  const signature = url.searchParams.get("sig") || "";
  if (!organizationId || !uid || !signature || !validSignature(organizationId, uid, signature)) {
    return NextResponse.json({ error: "Invalid calendar feed link." }, { status: 403 });
  }

  const memberDoc = await adminDb.doc(`organizations/${organizationId}/members/${uid}`).get();
  if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
    return NextResponse.json({ error: "Calendar feed is no longer active." }, { status: 403 });
  }

  const snapshot = await adminDb
    .collection(`organizations/${organizationId}/tasks`)
    .where("assignedTo", "==", uid)
    .get();
  const tasks = snapshot.docs
    .map((doc): TaskRecord => ({ id: doc.id, ...doc.data() }))
    .filter((task) => task.isDeleted !== true && task.dueAt) as TaskRecord[];
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vlingo Systems//CRM Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Vlingo CRM Tasks",
    "X-WR-CALDESC:Dated tasks assigned to you in Vlingo CRM.",
    ...tasks.flatMap((task) => taskEvent(task, request, organizationId)),
    "END:VCALENDAR",
  ].map(foldLine).join("\r\n");

  return new Response(`${body}\r\n`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
