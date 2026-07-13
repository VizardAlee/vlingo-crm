import { NextResponse } from "next/server";
import {
  authenticateCalendarRequest,
  CalendarRequestError,
  createGoogleOAuthState,
  googleAuthorizationUrl,
  googleCalendarStateCookie,
} from "@/lib/google-calendar/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { organizationId?: unknown };
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    }
    const { uid } = await authenticateCalendarRequest(request, organizationId);
    const oauth = createGoogleOAuthState(organizationId, uid);
    const response = NextResponse.json({ url: googleAuthorizationUrl(oauth.state) });
    response.cookies.set(googleCalendarStateCookie, oauth.cookieValue, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/api/integrations/google-calendar/callback",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const status = error instanceof CalendarRequestError ? error.status : 503;
    if (status >= 500) {
      console.error("[Google Calendar connect failed]", error);
    }
    const message = error instanceof Error ? error.message : "Unable to start Google Calendar connection.";
    return NextResponse.json({ error: message }, { status });
  }
}
