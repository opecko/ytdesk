import type { Track } from "../api/types";

/**
 * Moves queue[from] to position `to`. Returns the new queue and the index that keeps pointing at the playing track.
 * An autoplay track dropped right after a real one becomes part of the real queue (it's above the divider). Real
 * tracks never turn into autoplay ones, so turning autoplay off can't delete something the user queued.
 */
export function reorder(queue: Track[], index: number, from: number, to: number): { queue: Track[]; index: number } | null {
  if (from === to || !queue[from] || to < 0 || to >= queue.length) return null;
  const next = [...queue];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  if (moved.source === "autoplay" && next[to - 1]?.source !== "autoplay") next[to] = { ...moved, source: undefined };
  const newIndex =
    from === index ? to : from < index && to >= index ? index - 1 : from > index && to <= index ? index + 1 : index;
  return { queue: next, index: newIndex };
}
