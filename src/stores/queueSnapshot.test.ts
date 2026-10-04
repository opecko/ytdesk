import { describe, expect, it } from "vitest";
import type { Track } from "../api/types";
import { makeSnapshot, readSnapshot, type QueueSnapshot } from "./queueSnapshot";

const t = (i: number): Track => ({ type: "track", id: `vid${String(i).padStart(8, "0")}`, title: `T${i}`, subtitle: "", artists: ["A"] });
const base = (n: number, index: number): QueueSnapshot => ({
  queue: Array.from({ length: n }, (_, i) => t(i)), index, context: { title: "Mix" }, chips: [], activeChipId: null, shuffle: false, repeat: "off",
});

describe("queue snapshot", () => {
  it("round-trips and strips menu tokens", () => {
    const s = base(3, 1);
    s.queue[1] = { ...s.queue[1], menu: { toggles: [], historyRemoveToken: "x" } };
    const snap = makeSnapshot(s)!;
    expect(snap.queue[1].menu).toBeUndefined();
    expect(readSnapshot(JSON.stringify(snap))).toEqual(snap);
  });

  it("keeps a window around the current track", () => {
    const snap = makeSnapshot(base(1000, 500))!;
    expect(snap.queue).toHaveLength(351);
    expect(snap.queue[snap.index].id).toBe(t(500).id);
  });

  it("rejects empty state and malformed data", () => {
    expect(makeSnapshot(base(0, -1))).toBeNull();
    expect(readSnapshot(null)).toBeNull();
    expect(readSnapshot("{bad json")).toBeNull();
    expect(readSnapshot(JSON.stringify({ ...base(2, 5) }))).toBeNull();
    expect(readSnapshot(JSON.stringify({ ...base(2, 0), queue: [{ id: 1 }] }))).toBeNull();
    expect(readSnapshot(JSON.stringify({ ...base(2, 0), repeat: "weird" }))?.repeat).toBe("off");
  });
});
