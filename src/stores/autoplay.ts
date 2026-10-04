// Pure autoplay rules (no network, no store) so they can be unit-tested.
import { VIDEO_ID } from "../api/queue";
import type { Track } from "../api/types";

export type AutoplayKind = "single" | "ending";

export interface TriggerInput {
  enabled: boolean;
  repeat: "off" | "all" | "one";
  queueLength: number;
  index: number;
  /** Queue already has a source that will supply more (radio playlist pending, or a continuation). */
  hasMoreSource: boolean;
  /** Podcast episodes don't autoplay into music (YouTube Music turns autoplay off for them too). */
  podcast?: boolean;
}

/** When autoplay should fetch: a lone song, or the last / second-to-last track of a finite queue. */
export function autoplayTrigger(s: TriggerInput): AutoplayKind | null {
  if (!s.enabled || s.podcast || s.repeat !== "off" || s.index < 0 || s.queueLength === 0 || s.hasMoreSource) return null;
  if (s.queueLength === 1) return "single";
  return s.queueLength - 1 - s.index <= 1 ? "ending" : null;
}

/** Drops invalid ids, anything already queued or recently played, and duplicates; marks the rest as autoplay. */
export function dedupeAutoplay(fresh: Track[], queue: Track[], history: string[]): Track[] {
  const seen = new Set([...queue.map((t) => t.id), ...history]);
  const out: Track[] = [];
  for (const t of fresh) {
    if (!VIDEO_ID.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ ...t, source: "autoplay" });
  }
  return out;
}

export const HISTORY_SIZE = 50;

export function pushHistory(history: string[], id: string): string[] {
  return [...history.filter((h) => h !== id), id].slice(-HISTORY_SIZE);
}
