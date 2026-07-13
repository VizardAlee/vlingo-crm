import { firebaseClientEnv } from "@/lib/firebase/config";

export const dynamic = "force-static";

function workerSource() {
  const config = JSON.stringify({
    apiKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    appId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    authDomain: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    messagingSenderId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    projectId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  });

  return `
importScripts("/sw.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp(${config});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Vlingo CRM", {
    body: data.body || "You have a new CRM notification.",
    badge: "/icons/icon-192x192.png",
    data: { href: data.href || "/notifications" },
    icon: "/icons/icon-192x192.png",
    tag: data.dedupeKey || data.notificationId || "vlingo-crm-notification",
  });
});
`;
}

export function GET() {
  return new Response(workerSource(), {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
