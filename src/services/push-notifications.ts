"use client";

import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteToken, getToken } from "firebase/messaging";
import { db, getBeaconMessaging } from "@/lib/firebase/client";
import { firebaseClientEnv } from "@/lib/firebase/config";
import { orgCollectionPath } from "@/services/firestore-paths";

export type PushRegistrationResult =
  | { status: "enabled" }
  | { message: string; status: "unavailable" };

function assertPushConfig() {
  if (!firebaseClientEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    throw new Error("Browser push is not configured. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to the app environment.");
  }

  if (!db) {
    throw new Error("Firebase is not configured for browser push.");
  }
}

async function tokenDocumentId(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function activeServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support background notifications.");
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) {
    throw new Error("The Vlingo CRM background service is not active yet. Refresh the page and try again.");
  }

  return registration;
}

export async function registerPushSubscription(input: {
  branchId: string;
  organizationId: string;
  userId: string;
}): Promise<PushRegistrationResult> {
  try {
    assertPushConfig();
    const messaging = await getBeaconMessaging();
    if (!messaging) {
      return { message: "Firebase browser messaging is not supported on this device.", status: "unavailable" };
    }

    const registration = await activeServiceWorker();
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    if (!token) {
      return { message: "This browser did not return a notification registration.", status: "unavailable" };
    }

    const subscriptionId = await tokenDocumentId(token);
    await setDoc(doc(db!, orgCollectionPath(input.organizationId, "pushSubscriptions"), subscriptionId), {
      branchId: input.branchId,
      createdAt: serverTimestamp(),
      createdBy: input.userId,
      isDeleted: false,
      organizationId: input.organizationId,
      status: "active",
      token,
      updatedAt: serverTimestamp(),
      updatedBy: input.userId,
      userAgent: navigator.userAgent.slice(0, 500),
      userId: input.userId,
    }, { merge: true });

    return { status: "enabled" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to register this device for browser notifications.",
      status: "unavailable",
    };
  }
}

export async function removePushSubscription(input: { organizationId: string }) {
  assertPushConfig();
  const messaging = await getBeaconMessaging();
  if (!messaging) {
    return;
  }

  const registration = await activeServiceWorker();
  const token = await getToken(messaging, {
    serviceWorkerRegistration: registration,
    vapidKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });
  if (token) {
    await deleteDoc(doc(db!, orgCollectionPath(input.organizationId, "pushSubscriptions"), await tokenDocumentId(token)));
  }
  await deleteToken(messaging);
}
