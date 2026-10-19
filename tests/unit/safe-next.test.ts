import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/app/auth/safe-next";

describe("safeNext", () => {
  it.each([
    ["/upload", "/upload"],
    ["/groups?join=abc12345", "/groups?join=abc12345"],
    ["/wrapped/abcd1234?slide=3#top", "/wrapped/abcd1234?slide=3#top"],
    ["/groups/./x/../y", "/groups/y"],
    ["/", "/"],
  ])("accepts same-origin path %s", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["//evil.com"],
    ["//evil.com/path"],
    ["/\\evil.com"],
    ["/..//evil.com"],
    ["/a/..//evil.com"],
    ["/%2e%2e//evil.com"],
    ["https://evil.com"],
    ["http:evil.com"],
    ["javascript:alert(1)"],
    ["evil.com"],
    ["upload"],
    ["/up\\load"],
    ["/upload\n//evil.com"],
    ["/\tevil"],
    ["/x\u0000"],
    ["/x\u007f"],
    ["/auth/callback"],
    ["/auth/callback?next=/upload"],
  ])("rejects %j", (raw) => {
    expect(safeNext(raw as string | null | undefined)).toBeNull();
  });

  it("does not treat /authors as the auth flow", () => {
    expect(safeNext("/authors")).toBe("/authors");
  });

  it("exposes /upload as the default destination", () => {
    expect(DEFAULT_NEXT).toBe("/upload");
    expect(safeNext(DEFAULT_NEXT)).toBe(DEFAULT_NEXT);
  });
});
