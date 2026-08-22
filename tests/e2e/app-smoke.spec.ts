import { expect, test, type Page } from "@playwright/test";

const ignoredConsoleFragments = [
  "Download the React DevTools",
  "FirebaseError: Missing or insufficient permissions",
  "_next/webpack-hmr",
];

function captureUnexpectedConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (!ignoredConsoleFragments.some((fragment) => text.includes(fragment))) {
      errors.push(text);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("auth pages render without browser errors", async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);

  const loginResponse = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(loginResponse?.status()).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  const resetResponse = await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
  expect(resetResponse?.status()).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("launch-critical routes do not crash before authentication", async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  const routes = [
    "/dashboard",
    "/leads",
    "/leads/new",
    "/deals",
    "/finance",
    "/notifications",
    "/documents",
  ];

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(500);
  }

  expect(consoleErrors).toEqual([]);
});
