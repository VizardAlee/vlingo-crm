import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const adminOptions = privateKey
  ? {
      credential: cert({
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
        projectId,
      }),
      projectId,
    }
  : projectId
    ? { projectId }
    : undefined;

export const adminApp =
  getApps()[0] ??
  initializeApp(adminOptions);

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
