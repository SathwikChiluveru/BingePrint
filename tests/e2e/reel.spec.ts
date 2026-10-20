import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, makeReel, trackErrors } from "./helpers";

test("upload a quick export, watch every slide, reach the ending", async ({ page }) => {
  const errors = trackErrors(page);
  await makeReel(page);

  await expect(page.getByText("Your all-time").first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Walk to the last slide with the keyboard; the counter tells us how many there are
  const live = page.locator('[aria-live="polite"]').filter({ hasText: /slide \d+ of \d+/i }).first();
  const total = Number((await live.textContent())?.match(/of (\d+)/i)?.[1] ?? "0");
  expect(total).toBeGreaterThan(3);
  for (let i = 1; i < total; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(live).toContainText(new RegExp(`slide ${i + 1} of ${total}`, "i"));
    await expectNoHorizontalScroll(page);
  }

  // Signed out, the ending offers to sign in and start a group as its one red action
  const cta = page.getByRole("button", { name: /Sign in and start my group/ }).or(
    page.getByRole("link", { name: /Sign in and start my group/ })
  );
  await expect(cta.first()).toBeVisible();
  await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
  await expect(page.getByText(/Join a friend.s group/).first()).toBeVisible();

  await cta.first().click();
  await page.waitForURL(/\/auth\/login\?next=/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("reload resumes on the same slide", async ({ page }) => {
  await makeReel(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const live = page.locator('[aria-live="polite"]').filter({ hasText: /slide \d+ of \d+/i }).first();
  await expect(live).toContainText(/slide 3 of/i);
  await page.reload();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: /slide 3 of/i }).first()).toBeAttached();
});

test("a non-CSV file is refused with a clear message", async ({ page }) => {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  const alert = page.locator("#upload-error");
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText(/upload/i);
  await expect(page).toHaveURL(/\/upload$/);
});

test("an unknown reel id explains where the reel lives", async ({ page }) => {
  await page.goto("/wrapped/doesnotexist");
  await expect(page.getByText(/lives in the browser that made it/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /upload|reel/i }).first()).toBeVisible();
});
