import { test, expect } from "@playwright/test";

test.describe("Phase 16 smoke", () => {
  test("login page renders Verse brand and DevAuth form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "AT72 Verse" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/i })).toBeVisible();
  });

  test("home redirects toward chat (auth gate)", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/(chat|login)/);
    expect(page.url()).toMatch(/\/(chat|login)/);
  });
});
