import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

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

async function activeMember(organizationId: string, uid: string) {
  const memberDoc = await adminDb.doc(`organizations/${organizationId}/members/${uid}`).get();
  const member = memberDoc.data();
  return memberDoc.exists && member?.status === "active";
}

export async function POST(request: Request) {
  if (calendarSecret().length < 32) {
    return NextResponse.json({
      error: "CALENDAR_FEED_SECRET must be configured with at least 32 characters.",
    }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { organizationId?: unknown };
  const organizationId = typeof body.organizationId === "string" && body.organizationId.trim()
    ? body.organizationId.trim()
    : process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID || "";

  if (!organizationId) {
    return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
  }

  const decoded = await adminAuth.verifyIdToken(token);
  if (!await activeMember(organizationId, decoded.uid)) {
    return NextResponse.json({ error: "You do not have access to this organization." }, { status: 403 });
  }

  const params = new URLSearchParams({
    org: organizationId,
    sig: signFeed(organizationId, decoded.uid),
    uid: decoded.uid,
  });

  return NextResponse.json({
    url: `${appBaseUrl(request)}/api/calendar/tasks.ics?${params.toString()}`,
  });
}
