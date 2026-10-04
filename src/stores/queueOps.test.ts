import { describe, expect, it } from "vitest";
import type { Track } from "../api/types";
import { reorder } from "./queueOps";

const q = (ids: string, auto = ""): Track[] =>
  ids.split("").map((id) => ({ type: "track", id, title: id, subtitle: "", artists: [], ...(auto.includes(id) ? { source: "autoplay" as const } : {}) }));
const ids = (r: { queue: Track[] } | null) => r!.queue.map((t) => t.id).join("");

describe("reorder", () => {
  it("keeps the index on the playing track", () => {
    expect(reorder(q("abcde"), 2, 0, 4)).toMatchObject({ index: 1 }); // moved from before current to after
    expect(ids(reorder(q("abcde"), 2, 0, 4))).toBe("bcdea");
    expect(reorder(q("abcde"), 2, 4, 0)).toMatchObject({ index: 3 });
    expect(reorder(q("abcde"), 2, 2, 4)).toMatchObject({ index: 4 }); // dragging the playing track itself
    expect(reorder(q("abcde"), 2, 3, 4)).toMatchObject({ index: 2 }); // both after current
  });
  it("promotes an autoplay track dragged into the real queue", () => {
    const r = reorder(q("abcXY", "XY"), 0, 4, 1)!;
    expect(ids(r)).toBe("aYbcX");
    expect(r.queue[1].source).toBeUndefined();
    expect(reorder(q("abcXYZ", "XYZ"), 0, 5, 4)!.queue[4].source).toBe("autoplay"); // dropped among autoplay
    expect(reorder(q("abcXY", "XY"), 0, 1, 4)!.queue[4].source).toBeUndefined(); // real track stays real
  });
  it("ignores no-op and out-of-range moves", () => {
    expect(reorder(q("abc"), 0, 1, 1)).toBeNull();
    expect(reorder(q("abc"), 0, 5, 1)).toBeNull();
    expect(reorder(q("abc"), 0, 1, 9)).toBeNull();
  });
});
