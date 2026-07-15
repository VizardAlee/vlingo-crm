"use client";

import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  CircleDollarSign,
  Handshake,
  ListTodo,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { markNotificationRead, markNotificationsRead } from "@/services/notifications";
import type { AppNotification, NotificationKind } from "@/types/crm";

const notificationsChangedEvent = "beacon:notifications-changed";
const previewLimit = 6;

const kindIcons: Partial<Record<NotificationKind, typeof Bell>> = {
  activity: Activity,
  deal: Handshake,
  finance: CircleDollarSign,
  lead: Bell,
  task: ListTodo,
  renewal: CalendarClock,
};

function notificationDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return null;
}

function relativeTime(value: unknown) {
  const date = notificationDate(value);
  if (!date) return "Recently";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

interface NotificationMenuProps {
  branchId: string;
  items: AppNotification[];
  loading: boolean;
  onItemsChange: (items: AppNotification[]) => void;
  organizationId: string;
  userId: string;
}

export function NotificationMenu({ branchId, items, loading, onItemsChange, organizationId, userId }: NotificationMenuProps) {
  const router = useRouter();
  const toast = useToast();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [position, setPosition] = useState({ right: 12, top: 72 });
  const unreadCount = items.filter((item) => !item.readAt).length;
  const recentItems = useMemo(() => items.slice(0, previewLimit), [items]);

  useEffect(() => {
    if (!open) return;

    function placeMenu() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const headerBottom = trigger.closest("header")?.getBoundingClientRect().bottom ?? triggerRect.bottom;
      setPosition({
        right: Math.max(12, window.innerWidth - triggerRect.right),
        top: Math.round(headerBottom + 8),
      });
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function updateReadState(ids: string[]) {
    const readAt = new Date().toISOString();
    onItemsChange(items.map((item) => ids.includes(item.id) ? { ...item, readAt, readBy: userId } : item));
    window.dispatchEvent(new Event(notificationsChangedEvent));
  }

  function openNotification(item: AppNotification) {
    setOpen(false);
    if (!item.readAt) {
      updateReadState([item.id]);
      void markNotificationRead({ branchId, organizationId, userId }, item.id).catch((error) => {
        toast({
          title: "Unable to mark notification as read",
          description: error instanceof Error ? error.message : "The notification could not be updated.",
          variant: "error",
        });
      });
    }
    router.push(item.href || "/notifications");
  }

  async function markAllRead() {
    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length || savingAll) return;
    setSavingAll(true);
    try {
      await markNotificationsRead({ branchId, organizationId, userId }, unreadIds);
      updateReadState(unreadIds);
    } catch (error) {
      toast({
        title: "Unable to mark notifications as read",
        description: error instanceof Error ? error.message : "The notifications could not be updated.",
        variant: "error",
      });
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <>
      <span className="inline-flex shrink-0" ref={triggerRef}>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative"
          onClick={() => setOpen((value) => !value)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Bell className="h-4 w-4" />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </span>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[105] bg-black/20 sm:bg-transparent" onMouseDown={() => setOpen(false)}>
          <section
            aria-label="Recent notifications"
            aria-modal="true"
            className="fixed left-3 right-3 flex flex-col overflow-hidden rounded-md border bg-white shadow-2xl sm:left-auto sm:w-[25rem]"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            style={{ maxHeight: `calc(100dvh - ${position.top + 12}px)`, right: position.right, top: position.top }}
          >
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "You are all caught up"}</p>
              </div>
              <Button disabled={!unreadCount || savingAll} onClick={() => void markAllRead()} size="sm" type="button" variant="ghost">
                <CheckCheck className="h-4 w-4" />
                <span className="hidden min-[360px]:inline">{savingAll ? "Updating" : "Mark all read"}</span>
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div aria-label="Loading notifications" className="grid gap-1 p-3">
                  {[0, 1, 2].map((item) => (
                    <div className="flex animate-pulse gap-3 rounded-md p-2" key={item}>
                      <span className="h-10 w-10 shrink-0 rounded-full bg-muted" />
                      <span className="min-w-0 flex-1 space-y-2 py-1">
                        <span className="block h-3 w-2/3 rounded bg-muted" />
                        <span className="block h-3 w-full rounded bg-muted" />
                      </span>
                    </div>
                  ))}
                </div>
              ) : recentItems.length ? recentItems.map((item) => {
                const Icon = kindIcons[item.kind] ?? Bell;
                const unread = !item.readAt;
                return (
                  <button
                    className={cn(
                      "relative flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/60",
                      unread && "bg-primary/[0.06]",
                    )}
                    key={item.id}
                    onClick={() => openNotification(item)}
                    type="button"
                  >
                    <span className={cn(
                      "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full",
                      item.tone === "danger" ? "bg-destructive/10 text-destructive" : item.tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary",
                    )}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm leading-5 text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-xs font-medium text-primary">{relativeTime(item.triggerAt ?? item.createdAt)}</span>
                    </span>
                    {unread ? <span aria-label="Unread" className="mt-4 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
                  </button>
                );
              }) : (
                <div className="grid min-h-48 place-items-center px-6 text-center">
                  <div>
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Bell className="h-5 w-5" /></span>
                    <p className="mt-3 text-sm font-semibold">No notifications yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">New tasks and workflow updates will appear here.</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="border-t bg-white p-2">
              <ButtonLink className="w-full shadow-none" href="/notifications" onClick={() => setOpen(false)} variant="ghost">
                View all notifications
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
