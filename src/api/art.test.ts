import { expect, it } from "vitest";
import { hiResArt } from "./art";

it("upsizes artwork urls", () => {
  expect(hiResArt("https://lh3.googleusercontent.com/abc=w120-h120-l90-rj", "x")).toBe("https://lh3.googleusercontent.com/abc=w1200-h1200-l90-rj");
  expect(hiResArt("https://i.ytimg.com/vi/vid000000A1/sddefault.jpg", "vid000000A1")).toBe("https://i.ytimg.com/vi/vid000000A1/maxresdefault.jpg");
  expect(hiResArt(undefined)).toBeUndefined();
});

import { mediaArtwork } from "./art";

it("lists media session artwork largest first with fallbacks", () => {
  expect(mediaArtwork("https://lh3.googleusercontent.com/abc=w120-h120-l90-rj").map((a) => a.src)).toEqual([
    "https://lh3.googleusercontent.com/abc=w544-h544-l90-rj",
    "https://lh3.googleusercontent.com/abc=w120-h120-l90-rj",
  ]);
  expect(mediaArtwork("https://i.ytimg.com/vi/vid000000A1/sddefault.jpg", "vid000000A1").map((a) => a.sizes)).toEqual(["480x360", "120x120"]);
  expect(mediaArtwork("https://i.ytimg.com/vi/vid000000A1/sddefault.jpg", "vid000000A1", true).map((a) => a.sizes)).toEqual(["1280x720", "480x360", "120x120"]);
  expect(mediaArtwork(undefined)).toEqual([]);
});
