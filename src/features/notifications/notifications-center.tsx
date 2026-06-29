"use client";

import Link from "next/link";
import { where, type QueryConstraint } from "firebase/firestore";
import { AlertTriangle, Bell, CheckCircle2, Clock, FileClock, ListTodo, MessageSquare, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches, hasAnyPermission, hasPermission } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { ensureUserNotifications, listUserNotifications, markNotificationRead, markNotificationsRead, type NotificationDraft } from "@/services/notifications";
import { listOrgRecords } from "@/services/repository";
import type { AppNotification, NotificationKind, NotificationTone } from "@/types/crm";

const upcomingWindowDays = 7;
const renewalWindowDays = 60;
const notificationsChangedEvent = "beacon:notifications-changed";

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

  if (type === "deal") {
    return `/deals/${entityId}`;
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

export function NotificationsCenter() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canViewNotifications = hasAnyPermission(member, ["tasks.read", "leads.readAssigned", "leads.readAll", "deals.read", "rentals.read", "activities.read", "reports.viewFinancial"]);
  const context = useMemo(
    () => user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null,
    [activeBranchId, activeOrganizationId, user],
  );

  const loadNotifications = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const canReadAllLeads = hasPermission(member, "leads.readAll");
      const canReadElevatedTasks = hasAnyPermission(member, ["dashboard.viewExecutive", "users.manage"]);
      const branchConstraints = canAccessAllBranches(member) ? [] : [where("branchId", "==", activeBranchId || member?.branchId || "")];
      const taskConstraints = canReadElevatedTasks ? branchConstraints : [...branchConstraints, where("assignedTo", "==", user.uid)];
      const leadConstraints = canReadAllLeads ? branchConstraints : [...branchConstraints, where("assignedTo", "==", user.uid)];
      const [tasks, leads, rentals, activities] = await Promise.all([
        hasPermission(member, "tasks.read") ? safeList(activeOrganizationId, "tasks", taskConstraints) : [],
        hasAnyPermission(member, ["leads.readAssigned", "leads.readAll"]) ? safeList(activeOrganizationId, "leads", leadConstraints) : [],
        hasPermission(member, "rentals.read") ? safeList(activeOrganizationId, "rentalTenancies", branchConstraints) : [],
        hasPermission(member, "activities.read") ? safeList(activeOrganizationId, "activities", branchConstraints) : [],
      ]);
      const generated: NotificationDraft[] = [];

      tasks.forEach((task) => {
        if (!isOpenStatus(task.status)) {
          return;
        }

        const dueDays = daysUntil(task.dueAt);
        if (String(task.status) === "overdue" || (dueDays !== null && dueDays <= upcomingWindowDays)) {
          const overdue = String(task.status) === "overdue" || (dueDays !== null && dueDays < 0);
          generated.push({
            body: `${compactDueLabel(task.dueAt)} · ${titleCase(String(task.priority ?? "normal"))} priority`,
            triggerAt: parseDate(task.dueAt),
            href: `/tasks/${task.id}`,
            dedupeKey: `task:${task.id}:${String(task.dueAt ?? "")}:${String(task.status ?? "")}`,
            kind: "task",
            recipientId: user.uid,
            sourceCollection: "tasks",
            sourceId: task.id,
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
          generated.push({
            body: `${compactDueLabel(lead.nextFollowUpAt)} · ${titleCase(String(lead.status ?? "lead"))}`,
            triggerAt: parseDate(lead.nextFollowUpAt),
            href: `/leads/${lead.id}`,
            dedupeKey: `lead-followup:${lead.id}:${String(lead.nextFollowUpAt ?? "")}`,
            kind: "lead",
            recipientId: user.uid,
            sourceCollection: "leads",
            sourceId: lead.id,
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
          generated.push({
            body: `${formatCurrency(Number(rental.rentAmount ?? 0))} · ${compactDueLabel(rental.nextRentDueDate)}`,
            triggerAt: parseDate(rental.nextRentDueDate),
            href: `/rentals/${rental.id}`,
            dedupeKey: `rent:${rental.id}:${String(rental.nextRentDueDate ?? "")}:${paymentStatus}`,
            kind: "rent",
            recipientId: user.uid,
            sourceCollection: "rentalTenancies",
            sourceId: rental.id,
            title: `Rent due: ${String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}`,
            tone: overdue ? "danger" : "warning",
          });
        }

        const leaseDays = daysUntil(rental.leaseEndDate);
        if (leaseDays !== null && leaseDays <= renewalWindowDays) {
          generated.push({
            body: `Lease ends ${dateLabel(rental.leaseEndDate)} · ${leaseDays < 0 ? `${Math.abs(leaseDays)} days expired` : `${leaseDays} days left`}`,
            triggerAt: parseDate(rental.leaseEndDate),
            href: `/rentals/${rental.id}`,
            dedupeKey: `renewal:${rental.id}:${String(rental.leaseEndDate ?? "")}`,
            kind: "renewal",
            recipientId: user.uid,
            sourceCollection: "rentalTenancies",
            sourceId: rental.id,
            title: `Renewal review: ${String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}`,
            tone: leaseDays < 0 ? "danger" : leaseDays <= 14 ? "warning" : "info",
          });
        }
      });

      activities.slice(0, 8).forEach((activity) => {
        generated.push({
          body: `${titleCase(String(activity.type ?? "activity"))} · ${dateLabel(activity.updatedAt)}`,
          triggerAt: parseDate(activity.updatedAt),
          href: routeForActivity(activity.relatedEntityType, activity.relatedEntityId),
          dedupeKey: `activity:${activity.id}:${String(activity.updatedAt ?? "")}`,
          kind: "activity",
          recipientId: user.uid,
          sourceCollection: "activities",
          sourceId: activity.id,
          title: String(activity.subject ?? "Recent activity"),
          tone: "muted",
        });
      });

      const existing = await listUserNotifications(activeOrganizationId, user.uid);
      const createdCount = context ? await ensureUserNotifications(context, generated, existing) : 0;
      const persisted = createdCount ? await listUserNotifications(activeOrganizationId, user.uid) : existing;
      persisted.sort((first, second) => {
        const toneWeight: Record<NotificationTone, number> = { danger: 0, warning: 1, info: 2, success: 3, muted: 4 };
        const toneDelta = toneWeight[first.tone] - toneWeight[second.tone];
        if (toneDelta) {
          return toneDelta;
        }

        return (parseDate(first.triggerAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (parseDate(second.triggerAt)?.getTime() ?? Number.MAX_SAFE_INTEGER);
      });
      setItems(persisted);
      window.dispatchEvent(new Event(notificationsChangedEvent));
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load notifications.";
      setError(message);
      toast({ title: "Unable to load notifications", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, activeOrganizationId, context, member, toast, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadNotifications]);

  const summary = useMemo(() => {
    const unread = items.filter((item) => !item.readAt);
    return {
      attention: unread.filter((item) => item.tone === "danger" || item.tone === "warning").length,
      total: items.length,
      unread: unread.length,
    };
  }, [items]);

  async function markSeen(id: string) {
    if (!context) {
      return;
    }

    setSaving(id);
    setError(null);
    try {
      await markNotificationRead(context, id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString(), readBy: context.userId } : item));
      window.dispatchEvent(new Event(notificationsChangedEvent));
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update notification.";
      setError(message);
      toast({ title: "Unable to update notification", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function markAllSeen() {
    if (!context) {
      return;
    }

    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) {
      return;
    }

    setSaving("all");
    setError(null);
    try {
      await markNotificationsRead(context, unreadIds);
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, readAt, readBy: context.userId } : item));
      window.dispatchEvent(new Event(notificationsChangedEvent));
      toast({ title: "Notifications updated", description: "All notifications marked as read.", variant: "success" });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update notifications.";
      setError(message);
      toast({ title: "Unable to update notifications", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
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
          <Button disabled={!items.some((item) => !item.readAt) || saving === "all"} onClick={() => void markAllSeen()} type="button" variant="secondary">
            <CheckCircle2 className="h-4 w-4" />
            {saving === "all" ? "Saving" : "Mark all read"}
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
            const seen = Boolean(item.readAt);
            return (
              <div className={cn("rounded-md border p-3", seen ? "bg-white opacity-75" : "bg-muted/40")} key={item.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <Link className="flex min-w-0 gap-3 text-foreground hover:text-primary" href={item.href} onClick={() => { if (!seen) void markSeen(item.id); }}>
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", item.tone === "danger" ? "bg-destructive/10 text-destructive" : item.tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 md:justify-end">
                    <Badge tone={seen ? "muted" : item.tone}>{seen ? "Read" : titleCase(item.tone)}</Badge>
                    <Button disabled={seen || saving === item.id} onClick={() => void markSeen(item.id)} size="sm" type="button" variant="outline">{saving === item.id ? "Saving" : "Mark read"}</Button>
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
        <CardHeader><CardTitle>Push Ready</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This inbox now stores notification records and read state in Firestore. Firebase Cloud Messaging can reuse these records for browser push delivery when device tokens and templates are added.
        </CardContent>
      </Card>
    </section>
  );
}
