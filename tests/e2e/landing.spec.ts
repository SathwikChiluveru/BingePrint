import { expect, test } from "@playwright/test";
import { QUICK_CSV, expectNoHorizontalScroll, trackErrors } from "./helpers";

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

test("the How it works file zone builds a reel from the landing", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const input = page.locator("#landing-csv-input");
  await expect(input).toHaveAttribute("type", "file");
  await input.setInputFiles(QUICK_CSV);
  await page.waitForURL(/\/wrapped\/[^/?]+/);
  await expect(page.locator('[aria-roledescription="carousel"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("the landing zone refuses a wrong file and stays put", async ({ page }) => {
  await page.goto("/");
  await page.locator("#landing-csv-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  const alert = page.locator("#landing-file-error");
  await expect(alert).toContainText("That's not a CSV.");
  await expect(alert).not.toContainText(/upload/i);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("a file dragged anywhere on the landing is held, never opened by the browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#landing-csv-input")).toBeAttached();
  // The window guard cancels file drags outside the zone, so the browser's default (open the file) never runs.
  // Polled because the guard attaches on hydration.
  const dispatch = () =>
    page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["Title,Date"], "NetflixViewingHistory.csv", { type: "text/csv" }));
      return ["dragover", "drop"].map((type) => {
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
        document.querySelector("footer")!.dispatchEvent(ev);
        return ev.defaultPrevented;
      });
    });
  await expect.poll(dispatch).toEqual([true, true]);
  expect(new URL(page.url()).pathname).toBe("/");
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
