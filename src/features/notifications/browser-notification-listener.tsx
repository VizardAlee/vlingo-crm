"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { subscribeToUnreadUserNotifications } from "@/services/notifications";
import { registerPushSubscription } from "@/services/push-notifications";
import type { AppNotification } from "@/types/crm";

const shownPrefix = "vlingo:browser-notifications:shown";

function notificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function shownStorageKey(organizationId: string, userId: string) {
  return `${shownPrefix}:${organizationId}:${userId}`;
}

function readShownIds(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeShownIds(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-250)));
  } catch {
    // Browser storage may be unavailable; notifications should still work for this tab.
  }
}

function notificationBody(item: AppNotification) {
  return [item.body, item.href ? "Open Vlingo CRM to review." : ""].filter(Boolean).join("\n");
}

export function BrowserNotificationListener() {
  const { activeOrganizationId, member, user } = useAuth();
  const initialSnapshotSeen = useRef(false);
  const storageKey = user?.uid ? shownStorageKey(activeOrganizationId, user.uid) : "";

  useEffect(() => {
    if (!user?.uid || !member?.branchId || member.status !== "active" || !notificationSupported() || Notification.permission !== "granted") {
      return;
    }

    void registerPushSubscription({
      branchId: member.branchId,
      organizationId: activeOrganizationId,
      userId: user.uid,
    }).then((result) => {
      if (result.status === "unavailable") {
        console.warn("Background notification registration failed.", result.message);
      }
    });
  }, [activeOrganizationId, member?.branchId, member?.status, user?.uid]);

  useEffect(() => {
    if (!user?.uid || member?.status !== "active" || !notificationSupported() || Notification.permission !== "granted") {
      return;
    }

    initialSnapshotSeen.current = false;
    const shownIds = readShownIds(storageKey);
    return subscribeToUnreadUserNotifications(
      activeOrganizationId,
      user.uid,
      (items) => {
        if (!initialSnapshotSeen.current) {
          items.forEach((item) => shownIds.add(item.id));
          writeShownIds(storageKey, shownIds);
          initialSnapshotSeen.current = true;
          return;
        }

        items.forEach((item) => {
          if (shownIds.has(item.id)) {
            return;
          }

          shownIds.add(item.id);
          const notification = new Notification(item.title, {
            body: notificationBody(item),
            data: { href: item.href },
            icon: "/icons/icon-192x192.png",
            tag: item.dedupeKey || item.id,
          });
          notification.onclick = () => {
            window.focus();
            if (item.href) {
              window.location.assign(item.href);
            }
            notification.close();
          };
        });
        writeShownIds(storageKey, shownIds);
      },
      (error) => {
        console.warn("Browser notification listener failed.", error);
      },
    );
  }, [activeOrganizationId, member?.status, storageKey, user?.uid]);

  return null;
}

export async function requestBrowserNotificationPermission() {
  if (!notificationSupported()) {
    return "unsupported" as const;
  }

  if (Notification.permission === "granted") {
    return "granted" as const;
  }

  if (Notification.permission === "denied") {
    return "denied" as const;
  }

  return await Notification.requestPermission();
}

export function browserNotificationPermission() {
  if (!notificationSupported()) {
    return "unsupported" as const;
  }

  return Notification.permission;
}
