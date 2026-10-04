import { describe, expect, it } from "vitest";
import { loggedInFlag, makeYtFetch } from "./innertube";

describe("makeYtFetch", () => {
  const capture = () => {
    const calls: { url: string; headers: Headers }[] = [];
    const base = (async (u: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(u), headers: new Headers(init?.headers) });
      return new Response("{}");
    }) as typeof fetch;
    return { calls, f: makeYtFetch(base, { cookie: () => "SAPISID=abc; SID=x", authUser: () => 1 }) };
  };

  it("routes WEB_REMIX calls to music host with matching origin and auth", async () => {
    const { calls, f } = capture();
    await f("https://www.youtube.com/youtubei/v1/browse", { method: "POST", body: '{"context":{"client":{"clientName":"WEB_REMIX"}}}' });
    const { url, headers } = calls[0];
    expect(url).toBe("https://music.youtube.com/youtubei/v1/browse");
    expect(headers.get("Origin")).toBe("https://music.youtube.com");
    expect(headers.get("X-Goog-AuthUser")).toBe("1");
    expect(headers.get("Authorization")).toMatch(/^SAPISIDHASH \d+_[0-9a-f]{40}$/);
  });

  it("keeps www origin for other clients and leaves non-API urls alone", async () => {
    const { calls, f } = capture();
    await f("https://www.youtube.com/youtubei/v1/player", { method: "POST", body: '{"clientName":"WEB"}' });
    await f("https://www.youtube.com/iframe_api");
    expect(calls[0].headers.get("Origin")).toBe("https://www.youtube.com");
    expect(calls[1].headers.get("Cookie")).toBeNull();
  });

  it("authenticates playback stats pings (watch history)", async () => {
    const { calls, f } = capture();
    await f("https://s.youtube.com/api/stats/playback?docid=x&ver=2", { method: "GET" });
    expect(calls[0].headers.get("Cookie")).toContain("SAPISID");
    expect(calls[0].headers.get("Authorization")).toMatch(/^SAPISIDHASH /);
    expect(calls[0].headers.get("Origin")).toBe("https://s.youtube.com");
  });

  it("sends mobile clients without cookie auth", async () => {
    const { calls, f } = capture();
    await f("https://www.youtube.com/youtubei/v1/player", { method: "POST", body: '{"clientName":"ANDROID"}', headers: { Cookie: "SAPISID=x", Authorization: "SAPISIDHASH 1_a" } });
    expect(calls[0].headers.get("Cookie")).toBeNull();
    expect(calls[0].headers.get("Authorization")).toBeNull();
  });
});

it("reads logged_in tracking param", () => {
  const d = { responseContext: { serviceTrackingParams: [{ params: [{ key: "logged_in", value: "1" }] }] } };
  expect(loggedInFlag(d)).toBe(true);
  expect(loggedInFlag({})).toBeNull();
});
