import { AudioLines, GripVertical, Pause, Play } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import type { Track } from "../api/types";
import { usePlayer } from "../stores/player";
import ItemMenu from "./ItemMenu";
import { fmtTime } from "./PlayerBar";
import Thumb from "./Thumb";

/** Row whose drag handle was pressed; native drag only starts from the handle. */
let armed = -1;

interface RowProps {
  track: Track;
  i: number;
  current: boolean;
  played: boolean;
  playing: boolean;
  /** Drop indicator: line above or below this row. */
  drop: "before" | "after" | null;
  onDragOver: (i: number, e: DragEvent<HTMLLIElement>) => void;
  onDrop: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

const Row = memo(function Row({ track, i, current, played, playing, drop, onDragOver, onDrop, onDragEnd }: RowProps) {
  const { playIndex, togglePlay } = usePlayer.getState();
  return (
    <li
      data-index={i}
      data-current={current || undefined}
      draggable
      onDragStart={(e) => {
        if (armed !== i) return e.preventDefault();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
      }}
      onDragOver={(e) => onDragOver(i, e)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex items-center rounded-[var(--radius)] pr-1 hover:bg-[var(--hover)] ${current ? "bg-[var(--hover)]" : ""} ${played && !current ? "opacity-60" : ""}`}
    >
      {drop && <span className={`pointer-events-none absolute inset-x-2 h-0.5 rounded bg-[var(--accent)] ${drop === "before" ? "-top-px" : "-bottom-px"}`} />}
      <span
        aria-label={`Drag to reorder ${track.title}`}
        title="Drag to reorder"
        onPointerDown={() => (armed = i)}
        onPointerUp={() => (armed = -1)}
        className="flex h-10 w-6 shrink-0 cursor-grab items-center justify-center text-[var(--text-3)] opacity-0 hover:text-[var(--text-1)] active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical size={16} aria-hidden />
      </span>
      <button onClick={() => (current ? togglePlay() : playIndex(i))} aria-current={current ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left">
        <span className="relative shrink-0">
          <Thumb src={track.thumbnail} className="h-10 w-10" />
          <span className={`absolute inset-0 flex items-center justify-center rounded-[var(--radius)] bg-black/60 ${current ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {current ? (playing ? <><AudioLines size={18} className="group-hover:hidden" aria-hidden /><Pause size={18} fill="currentColor" className="hidden group-hover:block" aria-hidden /></> : <Play size={18} fill="currentColor" aria-hidden />) : <Play size={18} fill="currentColor" aria-hidden />}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{track.title}</span>
          <span className="block truncate text-xs text-[var(--text-2)]">{track.artists.join(", ") || track.subtitle}</span>
        </span>
        {track.explicit && <span className="rounded-sm bg-[var(--text-3)] px-1 text-[10px] font-bold text-black" aria-label="Explicit">E</span>}
        {track.durationSec !== undefined && <span className="text-xs tabular-nums text-[var(--text-2)]">{fmtTime(track.durationSec)}</span>}
      </button>
      <ItemMenu item={track} queueIndex={i} className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100" />
    </li>
  );
});

/**
 * Whole queue (played tracks stay, dimmed). Keeps the playing track first or second in view, separates autoplay
 * additions with a divider, and reorders by dragging the handle. Never subscribes to the playback clock.
 */
export default function QueueList({ autoScroll = false }: { autoScroll?: boolean }) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.status === "playing");
  const loading = usePlayer((s) => s.chipLoading);
  const ref = useRef<HTMLOListElement>(null);
  const firstScroll = useRef(true);
  const [dropAt, setDropAt] = useState<{ i: number; pos: "before" | "after" } | null>(null);
  const dropRef = useRef(dropAt);
  dropRef.current = dropAt;
  const currentId = queue[index]?.id;

  const indexRef = useRef(index);
  indexRef.current = index;
  // When the playing track changes (not on reorders), scroll so the previous track sits at the top: the current one
  // is the second visible row. The browser clamps at the end of the list.
  useLayoutEffect(() => {
    const index = indexRef.current;
    if (!autoScroll || index < 0) return;
    const list = ref.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${Math.max(index - 1, 0)}"]`);
    const box = list?.closest<HTMLElement>(".scroll-y");
    if (!row || !box) return;
    const delta = row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollBy({ top: delta, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [autoScroll, currentId]);

  useEffect(() => () => void (armed = -1), []);

  const onDragOver = useCallback((i: number, e: DragEvent<HTMLLIElement>) => {
    if (armed < 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = e.currentTarget.getBoundingClientRect();
    const pos = e.clientY < r.top + r.height / 2 ? "before" : "after";
    const cur = dropRef.current;
    if (cur?.i !== i || cur.pos !== pos) setDropAt({ i, pos });
  }, []);

  const onDragEnd = useCallback(() => {
    armed = -1;
    setDropAt(null);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const from = armed;
    const target = dropRef.current;
    armed = -1;
    setDropAt(null);
    if (from < 0 || !target) return;
    // Insertion point in the original list, then account for the removed source row.
    let to = target.pos === "before" ? target.i : target.i + 1;
    if (from < to) to -= 1;
    usePlayer.getState().moveTrack(from, to);
  }, []);

  if (!queue.length) return <p className="px-2 text-sm text-[var(--text-3)]">Queue is empty. Play something to fill it.</p>;
  const firstAutoplay = queue.findIndex((t) => t.source === "autoplay");
  return (
    <ol ref={ref} className={loading ? "pointer-events-none opacity-40" : ""} aria-busy={loading}>
      {queue.map((track, i) => (
        <QueueRowWithDivider key={`${track.id}:${i}`} divider={i === firstAutoplay}>
          <Row
            track={track}
            i={i}
            current={i === index}
            played={i < index}
            playing={playing}
            drop={dropAt?.i === i ? dropAt.pos : null}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        </QueueRowWithDivider>
      ))}
    </ol>
  );
}

function QueueRowWithDivider({ divider, children }: { divider: boolean; children: React.ReactNode }) {
  if (!divider) return <>{children}</>;
  return (
    <>
      <li role="separator" className="mx-2 mb-2 mt-3 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-[var(--text-3)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        Autoplay
        <span className="h-px flex-1 bg-[var(--line)]" />
      </li>
      {children}
    </>
  );
}
