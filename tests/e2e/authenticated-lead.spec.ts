import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@beacon.test";
const password = process.env.E2E_ADMIN_PASSWORD ?? "E2ePassword123!";

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  } catch (error) {
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    throw new Error(`Sign-in failed before dashboard navigation. Visible page text: ${visibleText}`, { cause: error });
  }
}

test.describe("@authenticated lead to deal workflow", () => {
  test.skip(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true", "Requires Firebase emulators and seeded E2E auth user.");

  test("creates a linked lead, opens a deal, and records deal finance", async ({ page }) => {
    const leadName = `E2E Lead ${Date.now()}`;
    const dealTitle = `${leadName} Buy deal`;

    await signIn(page);
    await page.goto("/leads/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Create Lead" })).toBeVisible();

    await page.getByLabel("Full name").fill(leadName);
    await page.getByLabel("Phone number").fill("+2348012345678");
    await page.getByLabel("WhatsApp number").fill("+2348012345678");
    await page.getByLabel("Property type").selectOption("Apartment");
    await page.getByLabel("Linked property").selectOption("e2e-property");
    await page.getByLabel("Linked unit").selectOption("e2e-unit");
    await page.getByLabel("Preferred location").fill("Lagos");
    await page.getByLabel("Budget maximum").fill("60000000");
    await page.getByLabel("Status").selectOption("qualified");
    await page.getByRole("button", { name: /create lead/i }).click();

    await expect(page.getByText("Lead created.")).toBeVisible();

    await page.goto("/leads", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("cell", { name: leadName })).toBeVisible();

    const leadRow = page.getByRole("row").filter({ hasText: leadName });
    await leadRow.getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: leadName })).toBeVisible();
    await page.getByRole("link", { name: /open deal/i }).click();

    await expect(page.getByRole("heading", { name: "Create Deal" })).toBeVisible();
    await expect(page.getByLabel("Deal title")).toHaveValue(dealTitle);
    await expect(page.getByLabel("Deal type")).toHaveValue("sale");
    await expect(page.getByLabel("Deal stage")).toHaveValue("qualified");
    await expect(page.locator('select[name="propertyId"]')).toHaveValue("e2e-property");
    await expect(page.locator('select[name="unitId"]')).toHaveValue("e2e-unit");
    await page.getByRole("button", { name: /save record/i }).click();

    await page.goto("/deals", { waitUntil: "domcontentloaded" });
    const dealRow = page.getByRole("row").filter({ hasText: dealTitle });
    await expect(dealRow).toBeVisible();
    await dealRow.getByRole("link", { name: new RegExp(dealTitle) }).click();
    await page.getByRole("link", { name: /create receipt/i }).click();

    await expect(page.getByRole("heading", { exact: true, name: "Finance" })).toBeVisible();
    await expect(page.getByLabel("Revenue source")).toHaveValue(/deal:/);
    await expect(page.getByLabel("Amount").first()).not.toHaveValue("");
    await page.getByLabel("Bank/reference").fill(`E2E-${Date.now()}`);
    await page.getByRole("button", { name: /create receipt/i }).click();
    await expect(page.getByText(/created and queued for verification/i)).toBeVisible();
    await page.getByRole("button", { name: /^verify$/i }).first().click();
    await expect(page.getByText(/verified/i)).toBeVisible();

    await page.goto("/deals", { waitUntil: "domcontentloaded" });
    await page.getByRole("row").filter({ hasText: dealTitle }).getByRole("link", { name: new RegExp(dealTitle) }).click();
    await expect(page.getByText("Finance Status")).toBeVisible();
    await expect(page.getByText("Paid").first()).toBeVisible();
  });
});
