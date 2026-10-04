import { describe, expect, it } from "vitest";
import { hasAuthCookie, netscapeCookies, parseCookie, sapisidHash } from "./cookie";

describe("cookie", () => {
  it("parses header with '=' in values and ignores junk", () => {
    expect(parseCookie("SID=a=b; ; novalue; SAPISID=xyz ")).toEqual({ SID: "a=b", SAPISID: "xyz" });
  });

  it("detects auth cookie", () => {
    expect(hasAuthCookie("SID=1; SAPISID=2")).toBe(true);
    expect(hasAuthCookie("SID=1; SAPISID=")).toBe(false);
    expect(hasAuthCookie("")).toBe(false);
  });

  it("computes SAPISIDHASH (sha1 of 'ts sapisid origin')", async () => {
    const h = await sapisidHash("abc", "https://music.youtube.com", 1700000000);
    expect(h).toBe("SAPISIDHASH 1700000000_" + h.split("_")[1]);
    expect(h.split("_")[1]).toMatch(/^[0-9a-f]{40}$/);
    const same = await sapisidHash("abc", "https://music.youtube.com", 1700000000);
    expect(same).toBe(h);
  });
});

it("builds a Netscape cookie file", () => {
  const out = netscapeCookies("SID=a; __Secure-3PAPISID=b", 100);
  expect(out.split("\n")).toEqual([
    "# Netscape HTTP Cookie File",
    `.youtube.com\tTRUE\t/\tFALSE\t${100 + 30 * 24 * 3600}\tSID\ta`,
    `.youtube.com\tTRUE\t/\tTRUE\t${100 + 30 * 24 * 3600}\t__Secure-3PAPISID\tb`,
    "",
  ]);
});
