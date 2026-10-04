import { expect, it } from "vitest";
import { historyPingUrl, makeCpn } from "./history";

it("builds the playback ping URL from a /player response", () => {
  const player = { playbackTracking: { videostatsPlaybackUrl: { baseUrl: "https://s.youtube.com/api/stats/playback?docid=abc&ei=x" } } };
  const url = new URL(historyPingUrl(player, "CPN0123456789abc")!);
  expect(url.host).toBe("s.youtube.com");
  expect(Object.fromEntries(url.searchParams)).toEqual({ docid: "abc", ei: "x", ver: "2", c: "WEB_REMIX", cpn: "CPN0123456789abc" });
});

it("rejects missing or foreign URLs", () => {
  expect(historyPingUrl({}, "x")).toBeNull();
  expect(historyPingUrl({ playbackTracking: { videostatsPlaybackUrl: { baseUrl: "https://evil.example/api/stats/playback" } } }, "x")).toBeNull();
});

it("makes 16-char nonces", () => {
  expect(makeCpn()).toMatch(/^[A-Za-z0-9_-]{16}$/);
});
