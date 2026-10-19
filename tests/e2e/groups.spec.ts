import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, trackErrors } from "./helpers";

test("groups chooser renders signed out", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/groups");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("a malformed invite code is rejected before any lookup", async ({ page }) => {
  await page.goto("/groups?join=abc");
  await expect(page.getByText(/invite link looks broken/)).toBeVisible();
});

test("a well-formed but unknown invite code says no group uses it", async ({ page }) => {
  await page.goto("/groups?join=k7mq4xhr2p");
  await expect(page.getByText(/No group uses the code/)).toBeVisible({ timeout: 15_000 });
});

test("group APIs require sign-in", async ({ request }) => {
  expect((await request.get("/api/groups")).status()).toBe(401);
  const create = await request.post("/api/groups", { data: { name: "Test crew" } });
  expect(create.status()).toBe(401);
  const join = await request.post("/api/groups/00000000-0000-0000-0000-000000000000/members", {
    data: { nickname: "x", inviteCode: "k7mq4xhr2p", wrappedData: {} },
  });
  expect(join.status()).toBe(401);
});

test("login page offers Google and email sign-in", async ({ page }) => {
  await page.goto("/auth/login?next=/groups");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
});

test("login ignores an off-site next parameter", async ({ page }) => {
  await page.goto("/auth/login?next=//evil.example.com");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // The page must not have navigated away
  expect(new URL(page.url()).host).toBe("localhost:3217");
});
