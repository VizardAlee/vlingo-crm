import { NextRequest, NextResponse } from "next/server";
import {
  createVlingoCalendar,
  encryptedRefreshToken,
  exchangeGoogleAuthorizationCode,
  googleAccountEmail,
  googleCalendarStateCookie,
  readCalendarConnection,
  saveCalendarConnection,
  syncExistingGoogleTasks,
  verifyGoogleOAuthState,
} from "@/lib/google-calendar/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function settingsUrl(request: Request, parameters: Record<string, string>) {
  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const url = new URL("/settings/calendar", baseUrl);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function redirectAndClear(request: Request, parameters: Record<string, string>) {
  const response = NextResponse.redirect(settingsUrl(request, parameters));
  response.cookies.set(googleCalendarStateCookie, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/api/integrations/google-calendar/callback",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectAndClear(request, { error: oauthError === "access_denied" ? "Google Calendar access was cancelled." : "Google could not authorize this connection." });
  }

  try {
    const code = request.nextUrl.searchParams.get("code") ?? "";
    const stateValue = request.nextUrl.searchParams.get("state") ?? "";
    if (!code || !stateValue) {
      throw new Error("Google did not return a complete authorization response.");
    }
    const state = verifyGoogleOAuthState(stateValue, request.cookies.get(googleCalendarStateCookie)?.value);
    const memberSnapshot = await adminDb.doc(`organizations/${state.organizationId}/members/${state.uid}`).get();
    const member = memberSnapshot.data();
    if (!memberSnapshot.exists || member?.status !== "active") {
      throw new Error("Your CRM membership is no longer active.");
    }

    const tokens = await exchangeGoogleAuthorizationCode(code);
    const googleEmail = await googleAccountEmail(tokens.access_token);
    const existing = await readCalendarConnection(state.organizationId, state.uid);
    const sameGoogleAccount = existing?.googleEmail.toLowerCase() === googleEmail.toLowerCase();
    const calendar = sameGoogleAccount && existing?.calendarId
      ? { id: existing.calendarId, summary: existing.calendarName }
      : await createVlingoCalendar(tokens.access_token);
    const encryptedToken = tokens.refresh_token
      ? encryptedRefreshToken(tokens.refresh_token)
      : sameGoogleAccount && existing?.encryptedRefreshToken
        ? existing.encryptedRefreshToken
        : "";
    if (!encryptedToken) {
      throw new Error("Google did not provide an offline credential. Reconnect and approve Calendar access when prompted.");
    }

    await saveCalendarConnection({
      branchId: typeof member.branchId === "string" ? member.branchId : undefined,
      calendarId: calendar.id,
      calendarName: calendar.summary || "Vlingo CRM Tasks",
      encryptedRefreshToken: encryptedToken,
      googleEmail,
      organizationId: state.organizationId,
      status: "active",
      userId: state.uid,
    });

    let synced = 0;
    try {
      synced = await syncExistingGoogleTasks(state.organizationId, state.uid, tokens.access_token, calendar.id);
    } catch (syncError) {
      console.error("[Google Calendar initial task sync failed]", syncError);
    }
    return redirectAndClear(request, { connected: "1", synced: String(synced) });
  } catch (error) {
    console.error("[Google Calendar callback failed]", error);
    const message = error instanceof Error ? error.message : "Unable to complete Google Calendar connection.";
    return redirectAndClear(request, { error: message.slice(0, 240) });
  }
}
