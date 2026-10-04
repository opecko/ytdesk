// Saved queue so a restart comes back with the last song ready to play (pure; wired up in player.ts).
import type { QueueChip, Track } from "../api/types";

export const SNAPSHOT_KEY = "queue-v1";
const KEEP_BEFORE = 50;
const KEEP_AFTER = 300;

export interface QueueSnapshot {
  queue: Track[];
  index: number;
  context: { playlistId?: string; params?: string; title?: string; continuation?: string; autoplay?: boolean };
  chips: QueueChip[];
  activeChipId: string | null;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
}

/** Trims a long queue around the current track and drops per-session menu tokens. */
export function makeSnapshot(s: QueueSnapshot): QueueSnapshot | null {
  if (s.index < 0 || !s.queue[s.index]) return null;
  const from = Math.max(0, s.index - KEEP_BEFORE);
  const queue = s.queue.slice(from, s.index + 1 + KEEP_AFTER).map(({ menu: _menu, ...t }) => t);
  return { ...s, queue, index: s.index - from };
}

/** Validates stored JSON; anything malformed means "start empty". */
export function readSnapshot(raw: string | null): QueueSnapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as QueueSnapshot;
    const ok =
      Array.isArray(s.queue) &&
      s.queue.every((t) => t && t.type === "track" && typeof t.id === "string" && typeof t.title === "string" && Array.isArray(t.artists)) &&
      Number.isInteger(s.index) && s.index >= 0 && s.index < s.queue.length;
    if (!ok) return null;
    return {
      queue: s.queue,
      index: s.index,
      context: s.context && typeof s.context === "object" ? s.context : {},
      chips: Array.isArray(s.chips) ? s.chips : [],
      activeChipId: typeof s.activeChipId === "string" ? s.activeChipId : null,
      shuffle: !!s.shuffle,
      repeat: s.repeat === "all" || s.repeat === "one" ? s.repeat : "off",
    };
  } catch {
    return null;
  }
}
