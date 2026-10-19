import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, trackErrors } from "./helpers";

test("landing shows the approved hero and links to the right places", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");

  await expect(page).toHaveTitle(/Autoplayed/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your watch history has some explaining to do."
  );
  await expect(page.getByRole("link", { name: /Get my reel/ }).first()).toHaveAttribute("href", "/upload");
  await expect(page.getByRole("link", { name: "Join a friend's group" }).first()).toHaveAttribute(
    "href",
    "/groups?mode=join"
  );
  await expect(page.getByText("Your file never leaves your browser.").first()).toBeVisible();
  await expect(page.getByLabel("Sample Autoplayed reel")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(page.locator("body")).not.toContainText("BingePrint");

  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("link preview metadata and image are served", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Autoplayed/);
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("privacy page renders", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText("never uploaded");
  await expectNoHorizontalScroll(page);
});
