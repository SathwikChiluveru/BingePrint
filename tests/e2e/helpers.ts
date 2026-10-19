import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const QUICK_CSV = path.join(__dirname, "..", "fixtures", "quick-us-mdy.csv");

/** Collects console errors and uncaught page errors so a test can assert none happened. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Uploads the synthetic quick export through /upload and waits for the reel. */
export async function makeReel(page: Page) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(QUICK_CSV);
  await page.waitForURL(/\/wrapped\/[^/?]+/);
  await expect(page.locator('[aria-roledescription="carousel"]')).toBeVisible();
}
