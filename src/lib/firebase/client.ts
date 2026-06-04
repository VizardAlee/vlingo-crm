"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { firebaseClientEnv, hasFirebaseClientConfig } from "@/lib/firebase/config";

function app() {
  if (!hasFirebaseClientConfig()) {
    return null;
  }

  return getApps()[0] ?? initializeApp({
    apiKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    appId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    authDomain: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    messagingSenderId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    projectId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const firebaseApp = app();
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const functions = firebaseApp ? getFunctions(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export function initializeBeaconAppCheck() {
  if (!firebaseApp || !firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY || typeof window === "undefined") {
    return;
  }

  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export async function getBeaconMessaging() {
  if (!firebaseApp || !(await isSupported())) {
    return null;
  }

  return getMessaging(firebaseApp);
}
