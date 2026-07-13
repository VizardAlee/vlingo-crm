"use client";

import { CalendarDays, CheckCircle2, ExternalLink, Link2, Link2Off, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PermissionDenied, LoadingState, ErrorState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission } from "@/lib/permissions";

interface CalendarStatus {
  calendarName: string | null;
  connected: boolean;
  googleEmail: string | null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function GoogleCalendarSettings() {
  const { activeOrganizationId, member, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canUseCalendar = hasAnyPermission(member, ["tasks.read", "tasks.create"]);

  const authenticatedFetch = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) {
      throw new Error("Sign in again before managing Google Calendar.");
    }
    const token = await user.getIdToken();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  }, [user]);

  const loadStatus = useCallback(async () => {
    if (!canUseCalendar || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/integrations/google-calendar?organizationId=${encodeURIComponent(activeOrganizationId)}`);
      const payload = await response.json().catch(() => ({})) as CalendarStatus & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load Google Calendar status.");
      }
      setStatus(payload);
    } catch (nextError) {
      setError(errorMessage(nextError, "Unable to load Google Calendar status."));
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, authenticatedFetch, canUseCalendar, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadStatus]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const callbackError = searchParams.get("error");
    if (connected === "1") {
      const synced = Number(searchParams.get("synced") || 0);
      toast({
        description: synced ? `${synced} existing dated task${synced === 1 ? "" : "s"} synced.` : "New dated tasks assigned to you will sync automatically.",
        title: "Google Calendar connected",
        variant: "success",
      });
      router.replace("/settings/calendar");
    } else if (callbackError) {
      toast({ description: callbackError, title: "Google Calendar connection failed", variant: "error" });
      router.replace("/settings/calendar");
    }
  }, [router, searchParams, toast]);

  async function connect() {
    setAction("connect");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/integrations/google-calendar/connect", {
        body: JSON.stringify({ organizationId: activeOrganizationId }),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Unable to start Google Calendar connection.");
      }
      window.location.assign(payload.url);
    } catch (nextError) {
      const message = errorMessage(nextError, "Unable to start Google Calendar connection.");
      setError(message);
      toast({ description: message, title: "Unable to connect", variant: "error" });
      setAction(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? The dedicated Vlingo CRM Tasks calendar and its synced events will be removed.")) {
      return;
    }
    setAction("disconnect");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/integrations/google-calendar", {
        body: JSON.stringify({ organizationId: activeOrganizationId }),
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to disconnect Google Calendar.");
      }
      setStatus({ calendarName: null, connected: false, googleEmail: null });
      toast({ title: "Google Calendar disconnected", variant: "success" });
    } catch (nextError) {
      const message = errorMessage(nextError, "Unable to disconnect Google Calendar.");
      setError(message);
      toast({ description: message, title: "Unable to disconnect", variant: "error" });
    } finally {
      setAction(null);
    }
  }

  if (!canUseCalendar) {
    return <PermissionDenied />;
  }
  if (loading) {
    return <LoadingState label="Loading Google Calendar connection" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Google Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Keep your assigned CRM tasks visible in your Google Calendar.</p>
        </div>
        <Button className="mt-4 h-11 w-full md:mt-0 md:w-auto" disabled={Boolean(action)} onClick={() => void loadStatus()} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Calendar connection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-col gap-4 rounded-md border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{status?.connected ? status.calendarName || "Vlingo CRM Tasks" : "Google Calendar is not connected"}</p>
                  {status?.connected ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span> : null}
                </div>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {status?.connected ? status.googleEmail : "Connect the Google account where you want assigned tasks to appear."}
                </p>
              </div>
            </div>
            <div className="grid shrink-0 gap-2 sm:flex">
              {status?.connected ? (
                <>
                  <Button disabled={Boolean(action)} onClick={() => void connect()} type="button" variant="outline">
                    <Link2 className="h-4 w-4" />
                    {action === "connect" ? "Opening Google" : "Reconnect"}
                  </Button>
                  <Button disabled={Boolean(action)} onClick={() => void disconnect()} type="button" variant="danger">
                    <Link2Off className="h-4 w-4" />
                    {action === "disconnect" ? "Disconnecting" : "Disconnect"}
                  </Button>
                </>
              ) : (
                <Button disabled={Boolean(action)} onClick={() => void connect()} type="button">
                  <ExternalLink className="h-4 w-4" />
                  {action === "connect" ? "Opening Google" : "Connect Google"}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-sm font-semibold">Automatic task sync</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Dated tasks assigned to you are created and updated in Google automatically.</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm font-semibold">Dedicated calendar</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">CRM tasks stay in a separate Vlingo calendar that you can show, hide, or color in Google.</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-success" /> Private connection</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">The CRM stores an encrypted offline credential. Other users cannot read your Google connection.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
