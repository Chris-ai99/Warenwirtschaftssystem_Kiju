import { expect, test } from "@playwright/test";

test("login page is scanner-display friendly", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect(page.getByLabel("Passwort")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
});
