"use client";

import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const installDismissedKey = "vlingo:pwa-install-dismissed";

function subscribeToNetworkStatus(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getNetworkStatus() {
  return navigator.onLine;
}

export function PwaRegistrar() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncFailed, setSyncFailed] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const online = useSyncExternalStore(subscribeToNetworkStatus, getNetworkStatus, () => true);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (window.localStorage.getItem(installDismissedKey) === "true") {
        return;
      }
      setInstallPrompt(event as InstallPromptEvent);
      setInstallDismissed(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const handleQueued = () => {
      setPendingWrites((count) => count + 1);
      setSyncFailed(false);
    };
    const handleFailed = () => setSyncFailed(true);
    window.addEventListener("vlingo:offline-write-queued", handleQueued);
    window.addEventListener("vlingo:offline-write-failed", handleFailed);
    return () => {
      window.removeEventListener("vlingo:offline-write-queued", handleQueued);
      window.removeEventListener("vlingo:offline-write-failed", handleFailed);
    };
  }, []);

  useEffect(() => {
    if (!online || !pendingWrites || !db) {
      return;
    }

    let active = true;
    void waitForPendingWrites(db)
      .then(() => {
        if (active) {
          setPendingWrites(0);
          setSyncFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setSyncFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [online, pendingWrites]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (window.location.protocol !== "https:" && !isLocalhost) {
      return;
    }

    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_PWA_IN_DEV !== "true") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      return;
    }

    let reloading = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    const handleControllerChange = () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
      hadController = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/", updateViaCache: "none" });
        if (registration.waiting) {
          setUpdateWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateWorker(worker);
            }
          });
        });
        await navigator.serviceWorker.ready;
        (navigator.serviceWorker.controller ?? registration.active)?.postMessage({ type: "CACHE_URLS", urls: [window.location.href] });
      } catch (error) {
        console.warn("Unable to register Vlingo CRM service worker.", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!online || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    void navigator.serviceWorker.ready.then((registration) => {
      (navigator.serviceWorker.controller ?? registration.active)?.postMessage({ type: "CACHE_URLS", urls: [window.location.href] });
    });
  }, [online, pathname]);

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  function dismissInstall() {
    window.localStorage.setItem(installDismissedKey, "true");
    setInstallDismissed(true);
  }

  if (online && !updateWorker && !syncFailed && !pendingWrites && (!installPrompt || installDismissed)) {
    return null;
  }

  return (
    <div className="no-print fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-xl items-center gap-3 rounded-md border bg-white p-3 text-sm shadow-2xl md:bottom-4">
      {!online ? <WifiOff className="h-5 w-5 shrink-0 text-warning" /> : updateWorker ? <RefreshCw className="h-5 w-5 shrink-0 text-primary" /> : <Download className="h-5 w-5 shrink-0 text-primary" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{!online ? "Working offline" : syncFailed ? "Offline change needs attention" : pendingWrites ? "Syncing changes" : updateWorker ? "Update available" : "Install Vlingo CRM"}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {!online
            ? `Cached records remain available.${pendingWrites ? ` ${pendingWrites} change${pendingWrites === 1 ? " is" : "s are"} queued.` : ""}`
            : syncFailed
              ? "At least one queued change was rejected. Refresh the affected record and try again."
              : pendingWrites
                ? `Sending ${pendingWrites} queued change${pendingWrites === 1 ? "" : "s"} to the server.`
                : updateWorker
                  ? "Refresh to use the latest app version."
                  : "Add the CRM to this device for quicker access."}
        </p>
      </div>
      {!online ? <Button onClick={() => window.location.reload()} size="sm" type="button" variant="outline">Retry</Button> : null}
      {updateWorker && !syncFailed && !pendingWrites ? <Button onClick={() => updateWorker.postMessage({ type: "SKIP_WAITING" })} size="sm" type="button">Update</Button> : null}
      {online && installPrompt && !installDismissed && !syncFailed && !pendingWrites ? <Button onClick={() => void installApp()} size="sm" type="button">Install</Button> : null}
      {online && installPrompt && !installDismissed && !updateWorker ? (
        <Button aria-label="Dismiss install prompt" onClick={dismissInstall} size="icon" type="button" variant="ghost"><X className="h-4 w-4" /></Button>
      ) : null}
    </div>
  );
}
