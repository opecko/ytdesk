import { describe, expect, it } from "vitest";
import type { Track } from "../api/types";
import { autoplayTrigger, dedupeAutoplay, pushHistory } from "./autoplay";

const t = (id: string): Track => ({ type: "track", id, title: id, subtitle: "", artists: [] });
const base = { enabled: true, repeat: "off" as const, queueLength: 10, index: 0, hasMoreSource: false };

describe("autoplayTrigger", () => {
  it("fires for a lone song and near the end of a finite queue", () => {
    expect(autoplayTrigger({ ...base, queueLength: 1 })).toBe("single");
    expect(autoplayTrigger({ ...base, index: 9 })).toBe("ending");
    expect(autoplayTrigger({ ...base, index: 8 })).toBe("ending");
    expect(autoplayTrigger({ ...base, index: 7 })).toBeNull();
  });
  it("respects the setting, repeat modes and queues that already have more coming", () => {
    expect(autoplayTrigger({ ...base, index: 9, enabled: false })).toBeNull();
    expect(autoplayTrigger({ ...base, index: 9, repeat: "all" })).toBeNull();
    expect(autoplayTrigger({ ...base, queueLength: 1, repeat: "one" })).toBeNull();
    expect(autoplayTrigger({ ...base, index: 9, hasMoreSource: true })).toBeNull();
    expect(autoplayTrigger({ ...base, queueLength: 0, index: -1 })).toBeNull();
    expect(autoplayTrigger({ ...base, queueLength: 1, podcast: true })).toBeNull();
  });
});

describe("dedupeAutoplay", () => {
  it("drops queued, recently played, invalid and duplicate ids and marks the rest", () => {
    const out = dedupeAutoplay(
      [t("aaaaaaaaaaa"), t("bbbbbbbbbbb"), t("ccccccccccc"), t("bad"), t("ddddddddddd"), t("ddddddddddd")],
      [t("aaaaaaaaaaa")],
      ["ccccccccccc"],
    );
    expect(out.map((x) => x.id)).toEqual(["bbbbbbbbbbb", "ddddddddddd"]);
    expect(out.every((x) => x.source === "autoplay")).toBe(true);
  });
});

it("keeps a bounded, most-recent-last history", () => {
  let h: string[] = [];
  for (let i = 0; i < 60; i++) h = pushHistory(h, `id${i}`);
  expect(h).toHaveLength(50);
  expect(pushHistory(["a", "b"], "a")).toEqual(["b", "a"]);
});
