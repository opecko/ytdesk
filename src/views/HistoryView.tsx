import { useState } from "react";
import type { Chip, Shelf, Track } from "../api/types";
import { getHistory } from "../api/ytm";
import ChipRow from "../components/ChipRow";
import LoadMore from "../components/LoadMore";
import { EmptyState, ErrorBox, Loading } from "../components/Status";
import TrackList from "../components/TrackList";
import { usePaged } from "../hooks/useData";
import { useUi } from "../stores/ui";

/** Listening history grouped by day, like music.youtube.com/history. */
export default function HistoryView() {
  const [chip, setChip] = useState<Chip | null>(null);
  const { items, chips, loading, error, hasMore, loadingMore, loadMore, reload } = usePaged<Shelf>(
    `history:${chip?.label ?? ""}`,
    () => getHistory(chip?.browse),
  );
  const removed = useUi((s) => s.removedHistory);
  const visible = (items ?? [])
    .map((s) => ({ ...s, items: s.items.filter((t) => t.type === "track" && !removed.has((t as Track).menu?.historyRemoveToken ?? "")) }))
    .filter((s) => s.items.length);
  return (
    <>
      <h1 className="mb-6 text-4xl font-bold tracking-tight">History</h1>
      <ChipRow chips={chips ?? []} label="History filters" isActive={(c) => c.label === chip?.label}
        onPick={(c) => setChip(c.label === chip?.label ? null : c)} />
      {error && !items ? <ErrorBox error={error} onRetry={reload} /> : loading || !items ? <Loading variant="list" /> : (
        <>
          {visible.length === 0 && <EmptyState title="No history yet" detail="Songs you play show up here." />}
          {visible.map((s, i) => (
            <section key={`${s.title}:${i}`} className="mb-10">
              {s.title && <h2 className="mb-3 text-xl font-bold">{s.title}</h2>}
              <TrackList tracks={s.items as Track[]} variant="table" radio />
            </section>
          ))}
          <LoadMore active={hasMore && !error} loading={loadingMore} onVisible={loadMore} />
        </>
      )}
    </>
  );
}
