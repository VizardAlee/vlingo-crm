"use client";

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
  type DocumentData,
  type Timestamp,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { createReference } from "@/lib/utils";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { AppNotification, NotificationKind, NotificationTone, OrgCollectionName } from "@/types/crm";

export interface NotificationDraft {
  body: string;
  dedupeKey: string;
  href: string;
  kind: NotificationKind;
  recipientId: string;
  sourceCollection?: OrgCollectionName;
  sourceId?: string;
  title: string;
  tone: NotificationTone;
  triggerAt?: Date | string | null;
}

export interface NotificationContext {
  branchId: string;
  organizationId: string;
  userId: string;
}

function assertDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }

  return db;
}

function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date || typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as Timestamp).toDate();
  }

  return null;
}

function serializeDraft(draft: NotificationDraft, context: NotificationContext) {
  return Object.fromEntries(Object.entries({
    ...draft,
    branchId: context.branchId,
    createdAt: serverTimestamp(),
    createdBy: context.userId,
    isDeleted: false,
    organizationId: context.organizationId,
    readAt: null,
    readBy: "",
    referenceNumber: createReference("NOTIF"),
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
  }).filter(([, value]) => value !== undefined)) as WithFieldValue<DocumentData>;
}

export async function listUserNotifications(organizationId: string, userId: string) {
  const firestore = assertDb();
  const snapshot = await getDocs(query(
    collection(firestore, orgCollectionPath(organizationId, "notifications")),
    where("isDeleted", "==", false),
    where("recipientId", "==", userId),
    limit(150),
  ));

  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        createdAt: normalizeDate(data.createdAt),
        readAt: normalizeDate(data.readAt),
        triggerAt: normalizeDate(data.triggerAt),
        updatedAt: normalizeDate(data.updatedAt),
      } as AppNotification;
    })
    .sort((first, second) => {
      const firstDate = normalizeDate(first.triggerAt ?? first.updatedAt ?? first.createdAt);
      const secondDate = normalizeDate(second.triggerAt ?? second.updatedAt ?? second.createdAt);
      return new Date(String(secondDate ?? 0)).getTime() - new Date(String(firstDate ?? 0)).getTime();
    });
}

export async function ensureUserNotifications(context: NotificationContext, drafts: NotificationDraft[], existing: AppNotification[]) {
  const firestore = assertDb();
  const existingKeys = new Set(existing.map((item) => item.dedupeKey));
  const uniqueDrafts = drafts.filter((draft, index, allDrafts) => {
    if (existingKeys.has(draft.dedupeKey)) {
      return false;
    }

    return allDrafts.findIndex((item) => item.dedupeKey === draft.dedupeKey) === index;
  });

  await Promise.all(uniqueDrafts.map((draft) => addDoc(
    collection(firestore, orgCollectionPath(context.organizationId, "notifications")),
    serializeDraft(draft, context),
  )));

  return uniqueDrafts.length;
}

export async function markNotificationRead(context: NotificationContext, notificationId: string) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, orgCollectionPath(context.organizationId, "notifications"), notificationId), {
    organizationId: context.organizationId,
    readAt: serverTimestamp(),
    readBy: context.userId,
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
  });
}

export async function markNotificationsRead(context: NotificationContext, notificationIds: string[]) {
  await Promise.all(notificationIds.map((id) => markNotificationRead(context, id)));
}
