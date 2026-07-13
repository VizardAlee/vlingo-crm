import { NextResponse } from "next/server";
import {
  authenticateCalendarRequest,
  CalendarRequestError,
  decryptedRefreshToken,
  deleteVlingoCalendar,
  readCalendarConnection,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  calendarConnectionRef,
} from "@/lib/google-calendar/server";

export const runtime = "nodejs";

function organizationFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
}

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof CalendarRequestError ? error.status : 503;
  if (status >= 500) {
    console.error(`[Google Calendar API failed] ${fallback}`, error);
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status });
}

export async function GET(request: Request) {
  try {
    const organizationId = organizationFromRequest(request);
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    }
    const { uid } = await authenticateCalendarRequest(request, organizationId);
    const connection = await readCalendarConnection(organizationId, uid);
    return NextResponse.json({
      calendarName: connection?.calendarName ?? null,
      connected: connection?.status === "active",
      googleEmail: connection?.googleEmail ?? null,
    });
  } catch (error) {
    return errorResponse(error, "Unable to load Google Calendar status.");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { organizationId?: unknown };
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    }
    const { uid } = await authenticateCalendarRequest(request, organizationId);
    const connection = await readCalendarConnection(organizationId, uid);
    if (connection) {
      const refreshToken = decryptedRefreshToken(connection.encryptedRefreshToken);
      try {
        const accessToken = await refreshGoogleAccessToken(connection.encryptedRefreshToken);
        await deleteVlingoCalendar(accessToken, connection.calendarId);
      } catch (calendarError) {
        console.warn("[Google Calendar removal warning]", calendarError);
      }
      await revokeGoogleToken(refreshToken).catch((revokeError) => console.warn("[Google token revocation warning]", revokeError));
      await calendarConnectionRef(organizationId, uid).delete();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to disconnect Google Calendar.");
  }
}
