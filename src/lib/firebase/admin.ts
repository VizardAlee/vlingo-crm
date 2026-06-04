import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const adminApp =
  getApps()[0] ??
  initializeApp(
    privateKey
      ? {
          credential: cert({
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey,
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          }),
        }
      : undefined,
  );

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
