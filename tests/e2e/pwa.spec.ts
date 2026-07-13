import { expect, test } from "@playwright/test";

test.describe("production PWA", () => {
  test.skip(process.env.PWA_E2E !== "true", "Run against a production build with PWA_E2E=true.");

  test("is installable and reloads a visited screen offline", async ({ context, page }) => {
    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe("Vlingo Systems CRM");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]));

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/login", { waitUntil: "networkidle" });
    const serviceWorkerUrl = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL ?? "");
    expect(serviceWorkerUrl).toMatch(/\/firebase-messaging-sw\.js$/);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller ?? registration.active;
      if (!worker) throw new Error("No active service worker available.");
      const requestId = crypto.randomUUID();
      await new Promise<void>((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === "CACHE_COMPLETE" && event.data.requestId === requestId) {
            navigator.serviceWorker.removeEventListener("message", handleMessage);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener("message", handleMessage);
        worker.postMessage({ requestId, type: "CACHE_URLS", urls: [window.location.href] });
      });
    });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Working offline")).toBeVisible();
    await page.screenshot({ fullPage: true, path: "/tmp/vlingo-pwa-mobile-offline.png" });

    await context.setOffline(false);
    await page.setViewportSize({ height: 1024, width: 768 });
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ fullPage: true, path: "/tmp/vlingo-pwa-tablet.png" });
  });
});
