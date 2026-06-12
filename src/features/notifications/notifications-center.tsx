"use client";

import Link from "next/link";
import { where, type QueryConstraint } from "firebase/firestore";
import { AlertTriangle, Bell, CheckCircle2, Clock, FileClock, ListTodo, MessageSquare, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { listOrgRecords } from "@/services/repository";

type NotificationTone = "danger" | "warning" | "info" | "success" | "muted";
type NotificationKind = "task" | "lead" | "rent" | "renewal" | "activity";

interface NotificationItem {
  body: string;
  date?: Date | null;
  href: string;
  id: string;
  kind: NotificationKind;
  title: string;
  tone: NotificationTone;
}

const upcomingWindowDays = 7;
const renewalWindowDays = 60;

function parseDate(value: unknown) {
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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysUntil(value: unknown) {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  const today = startOfToday();
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function dateLabel(value: unknown) {
  const date = parseDate(value);
  return date ? formatDate(date) : "No date set";
}

function compactDueLabel(value: unknown) {
  const days = daysUntil(value);
  if (days === null) {
    return "No date set";
  }

  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

function isOpenStatus(value: unknown) {
  return !["completed", "cancelled", "converted", "lost", "terminated", "movedOut"].includes(String(value ?? ""));
}

function routeForActivity(type: unknown, id: unknown) {
  const entityId = String(id ?? "");
  if (!entityId) {
    return "/activities";
  }

  if (type === "lead") {
    return `/leads/${entityId}`;
  }

  if (type === "client") {
    return `/clients/${entityId}`;
  }

  if (type === "property") {
    return `/properties/${entityId}`;
  }

  if (type === "unit") {
    return `/units/${entityId}`;
  }

  if (type === "task") {
    return `/tasks/${entityId}`;
  }

  if (type === "tenancy") {
    return `/rentals/${entityId}`;
  }

  if (type === "development") {
    return `/development/${entityId}`;
  }

  if (type === "marketing") {
    return `/marketing/${entityId}`;
  }

  return "/activities";
}

async function safeList(organizationId: string, collectionName: Parameters<typeof listOrgRecords<Record<string, unknown> & { id: string }>>[1], constraints: QueryConstraint[] = []) {
  try {
    return await listOrgRecords<Record<string, unknown> & { id: string }>(organizationId, collectionName, constraints);
  } catch {
    return [];
  }
}

function notificationIcon(kind: NotificationKind) {
  if (kind === "task") {
    return ListTodo;
  }

  if (kind === "lead") {
    return Bell;
  }

  if (kind === "rent") {
    return WalletCards;
  }

  if (kind === "renewal") {
    return FileClock;
  }

  return MessageSquare;
}

function seenStorageKey(organizationId: string, userId: string) {
  return `beacon-notifications-seen:${organizationId}:${userId}`;
}

function readSeenIds(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? new Set(JSON.parse(value) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeSeenIds(key: string, ids: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...ids].slice(-500)));
}

export function NotificationsCenter() {
  const { activeOrganizationId, member, user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewNotifications = hasAnyPermission(member, ["tasks.read", "leads.readAssigned", "leads.readAll", "rentals.read", "activities.read"]);
  const storageKey = user ? seenStorageKey(activeOrganizationId, user.uid) : "";

  const loadNotifications = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const canReadAllLeads = hasPermission(member, "leads.readAll");
      const canReadElevatedTasks = hasAnyPermission(member, ["dashboard.viewExecutive", "users.manage"]);
      const taskConstraints = canReadElevatedTasks ? [] : [where("assignedTo", "==", user.uid)];
      const leadConstraints = canReadAllLeads ? [] : [where("assignedTo", "==", user.uid)];
      const [tasks, leads, rentals, activities] = await Promise.all([
        hasPermission(member, "tasks.read") ? safeList(activeOrganizationId, "tasks", taskConstraints) : [],
        hasAnyPermission(member, ["leads.readAssigned", "leads.readAll"]) ? safeList(activeOrganizationId, "leads", leadConstraints) : [],
        hasPermission(member, "rentals.read") ? safeList(activeOrganizationId, "rentalTenancies") : [],
        hasPermission(member, "activities.read") ? safeList(activeOrganizationId, "activities") : [],
      ]);
      const nextItems: NotificationItem[] = [];

      tasks.forEach((task) => {
        if (!isOpenStatus(task.status)) {
          return;
        }

        const dueDays = daysUntil(task.dueAt);
        if (String(task.status) === "overdue" || (dueDays !== null && dueDays <= upcomingWindowDays)) {
          const overdue = String(task.status) === "overdue" || (dueDays !== null && dueDays < 0);
          nextItems.push({
            body: `${compactDueLabel(task.dueAt)} · ${titleCase(String(task.priority ?? "normal"))} priority`,
            date: parseDate(task.dueAt),
            href: `/tasks/${task.id}`,
            id: `task:${task.id}:${String(task.dueAt ?? "")}:${String(task.status ?? "")}`,
            kind: "task",
            title: String(task.title ?? "Task needs attention"),
            tone: overdue ? "danger" : "warning",
          });
        }
      });

      leads.forEach((lead) => {
        if (!isOpenStatus(lead.status)) {
          return;
        }

        const followUpDays = daysUntil(lead.nextFollowUpAt);
        if (followUpDays !== null && followUpDays <= upcomingWindowDays) {
          nextItems.push({
            body: `${compactDueLabel(lead.nextFollowUpAt)} · ${titleCase(String(lead.status ?? "lead"))}`,
            date: parseDate(lead.nextFollowUpAt),
            href: `/leads/${lead.id}`,
            id: `lead-followup:${lead.id}:${String(lead.nextFollowUpAt ?? "")}`,
            kind: "lead",
            title: `Follow up ${String(lead.fullName ?? "lead")}`,
            tone: followUpDays < 0 ? "danger" : "warning",
          });
        }
      });

      rentals.forEach((rental) => {
        if (!isOpenStatus(rental.status)) {
          return;
        }

        const rentDays = daysUntil(rental.nextRentDueDate);
        const paymentStatus = String(rental.paymentStatus ?? "notInvoiced");
        if (paymentStatus === "overdue" || (rentDays !== null && rentDays <= upcomingWindowDays)) {
          const overdue = paymentStatus === "overdue" || (rentDays !== null && rentDays < 0);
          nextItems.push({
            body: `${formatCurrency(Number(rental.rentAmount ?? 0))} · ${compactDueLabel(rental.nextRentDueDate)}`,
            date: parseDate(rental.nextRentDueDate),
            href: `/rentals/${rental.id}`,
            id: `rent:${rental.id}:${String(rental.nextRentDueDate ?? "")}:${paymentStatus}`,
            kind: "rent",
            title: `Rent due: ${String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}`,
            tone: overdue ? "danger" : "warning",
          });
        }

        const leaseDays = daysUntil(rental.leaseEndDate);
        if (leaseDays !== null && leaseDays <= renewalWindowDays) {
          nextItems.push({
            body: `Lease ends ${dateLabel(rental.leaseEndDate)} · ${leaseDays < 0 ? `${Math.abs(leaseDays)} days expired` : `${leaseDays} days left`}`,
            date: parseDate(rental.leaseEndDate),
            href: `/rentals/${rental.id}`,
            id: `renewal:${rental.id}:${String(rental.leaseEndDate ?? "")}`,
            kind: "renewal",
            title: `Renewal review: ${String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}`,
            tone: leaseDays < 0 ? "danger" : leaseDays <= 14 ? "warning" : "info",
          });
        }
      });

      activities.slice(0, 8).forEach((activity) => {
        nextItems.push({
          body: `${titleCase(String(activity.type ?? "activity"))} · ${dateLabel(activity.updatedAt)}`,
          date: parseDate(activity.updatedAt),
          href: routeForActivity(activity.relatedEntityType, activity.relatedEntityId),
          id: `activity:${activity.id}:${String(activity.updatedAt ?? "")}`,
          kind: "activity",
          title: String(activity.subject ?? "Recent activity"),
          tone: "muted",
        });
      });

      nextItems.sort((first, second) => {
        const toneWeight: Record<NotificationTone, number> = { danger: 0, warning: 1, info: 2, success: 3, muted: 4 };
        const toneDelta = toneWeight[first.tone] - toneWeight[second.tone];
        if (toneDelta) {
          return toneDelta;
        }

        return (first.date?.getTime() ?? Number.MAX_SAFE_INTEGER) - (second.date?.getTime() ?? Number.MAX_SAFE_INTEGER);
      });
      setItems(nextItems);
      setSeenIds(readSeenIds(seenStorageKey(activeOrganizationId, user.uid)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, member, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadNotifications]);

  const summary = useMemo(() => {
    const unread = items.filter((item) => !seenIds.has(item.id));
    return {
      attention: unread.filter((item) => item.tone === "danger" || item.tone === "warning").length,
      total: items.length,
      unread: unread.length,
    };
  }, [items, seenIds]);

  function markSeen(id: string) {
    if (!storageKey) {
      return;
    }

    const next = new Set(seenIds);
    next.add(id);
    setSeenIds(next);
    writeSeenIds(storageKey, next);
  }

  function markAllSeen() {
    if (!storageKey) {
      return;
    }

    const next = new Set(items.map((item) => item.id));
    setSeenIds(next);
    writeSeenIds(storageKey, next);
  }

  if (!canViewNotifications) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading notifications" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Actionable reminders from tasks, leads, rent, renewals, and recent activity.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          <Button onClick={loadNotifications} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button disabled={!items.length} onClick={markAllSeen} type="button" variant="secondary">
            <CheckCircle2 className="h-4 w-4" />
            Mark all seen
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Bell, label: "Unread", value: summary.unread },
          { icon: AlertTriangle, label: "Need attention", value: summary.attention },
          { icon: Clock, label: "Total", value: summary.total },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-semibold">{metric.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {items.length ? items.map((item) => {
            const Icon = notificationIcon(item.kind);
            const seen = seenIds.has(item.id);
            return (
              <div className={cn("rounded-md border p-3", seen ? "bg-white opacity-75" : "bg-muted/40")} key={item.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <Link className="flex min-w-0 gap-3 text-foreground hover:text-primary" href={item.href} onClick={() => markSeen(item.id)}>
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", item.tone === "danger" ? "bg-destructive/10 text-destructive" : item.tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 md:justify-end">
                    <Badge tone={seen ? "muted" : item.tone}>{seen ? "Seen" : titleCase(item.tone)}</Badge>
                    <Button disabled={seen} onClick={() => markSeen(item.id)} size="sm" type="button" variant="outline">Seen</Button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No notifications right now.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Browser Push</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This inbox is live from CRM records. Browser push can be connected next through Firebase Cloud Messaging once notification delivery rules and templates are finalized.
        </CardContent>
      </Card>
    </section>
  );
}
