import { Play } from "lucide-react";
import { useState } from "react";
import type { Chip, Item, Page, SearchGroup, SearchResults, Track } from "../api/types";
import { search } from "../api/ytm";
import LoadMore from "../components/LoadMore";
import { ItemGrid, ShelfRow } from "../components/Shelves";
import { EmptyState, ErrorBox, Loading } from "../components/Status";
import Thumb from "../components/Thumb";
import TrackList from "../components/TrackList";
import { useAsync, usePaged } from "../hooks/useData";
import { openItem } from "../stores/nav";
import { usePlayer } from "../stores/player";

const GROUP_TITLE: Record<SearchGroup, string> = {
  songs: "Songs", videos: "Videos", albums: "Albums", artists: "Artists",
  playlists: "Playlists", podcasts: "Podcasts", episodes: "Episodes",
};
const isTrack = (i: Item): i is Track & Item => i.type === "track";

function activate(item: Item) {
  if (isTrack(item)) usePlayer.getState().playRadio(item);
  else openItem(item);
}

function TopResult({ items }: { items: Item[] }) {
  const [top, ...rest] = items;
  if (!top) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-bold">Top result</h2>
      <div className="flex flex-col gap-4 lg:flex-row">
        <button
          onClick={() => activate(top)}
          className="group flex min-w-0 items-center gap-4 rounded-lg bg-[var(--surface-2)] p-4 text-left hover:bg-[var(--surface-3)] lg:w-[420px]"
        >
          <Thumb src={top.thumbnail} round={top.art === "round"} className="h-24 w-24 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold">{top.title}</span>
            <span className="mt-1 block truncate text-sm text-[var(--text-2)]">{top.subtitle}</span>
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black opacity-0 group-hover:opacity-100" aria-hidden>
            <Play size={20} fill="currentColor" />
          </span>
        </button>
        {rest.length > 0 && (
          <div className="min-w-0 flex-1">
            <TrackList tracks={rest.filter(isTrack)} radio compact />
          </div>
        )}
      </div>
    </section>
  );
}

function Overview({ res }: { res: SearchResults }) {
  const empty = !res.top.length && !res.shelves.length && !res.groups.length;
  if (empty) return <EmptyState title="No results" detail={res.messages.join(" ") || "Try a different search."} />;
  return (
    <>
      <TopResult items={res.top} />
      {res.shelves.map((s, i) => (
        <section key={`${s.title}:${i}`} className="mb-8">
          <h2 className="mb-4 text-xl font-bold">{s.title}</h2>
          {s.items.every(isTrack) ? <TrackList tracks={s.items as Track[]} radio /> : <ShelfRow shelf={{ ...s, title: "" }} />}
        </section>
      ))}
      {res.groups.map((g) =>
        g.id === "songs" || g.id === "videos" || g.id === "episodes" ? (
          <section key={g.id} className="mb-8">
            <h2 className="mb-4 text-xl font-bold">{GROUP_TITLE[g.id]}</h2>
            <TrackList tracks={g.items as Track[]} radio />
          </section>
        ) : (
          <ShelfRow key={g.id} shelf={{ title: GROUP_TITLE[g.id], items: g.items, layout: "carousel" }} />
        ),
      )}
    </>
  );
}

function Filtered({ query, chip }: { query: string; chip: Chip }) {
  const params = chip.searchParams!;
  const first = async (): Promise<Page<Item>> => {
    const wrap = (r: SearchResults): Page<Item> => ({
      items: [...r.shelves, ...r.groups].flatMap((s) => s.items),
      loadMore: r.next ? async () => wrap(await search(query, params, r.next!)) : null,
    });
    return wrap(await search(query, params));
  };
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } = usePaged(`search:${query}:${params}`, first);
  if (error && !items) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !items) return <Loading variant="list" label="Searching" />;
  if (!items.length) return <EmptyState title="No results" detail={`Nothing in "${chip.label}".`} />;
  return (
    <>
      {items.every(isTrack) ? <TrackList tracks={items as Track[]} radio /> : <ItemGrid items={items} />}
      {error && <ErrorBox error={error} onRetry={loadMore} />}
      <LoadMore active={hasMore && !error} loading={loadingMore} onVisible={loadMore} />
    </>
  );
}

export default function SearchView({ query }: { query: string }) {
  const [chip, setChip] = useState<Chip | null>(null);
  const overview = useAsync(`search:${query}`, () => search(query));
  const chips = overview.data?.chips.filter((c) => c.searchParams) ?? [];

  return (
    <>
      <div className="no-scrollbar -mx-2 mb-6 flex gap-2 overflow-x-auto px-2" role="toolbar" aria-label="Filter results">
        {chips.map((c) => (
          <button key={c.label} className="chip" aria-pressed={chip?.label === c.label} onClick={() => setChip(chip?.label === c.label ? null : c)}>
            {c.label}
          </button>
        ))}
      </div>
      {chip ? (
        <Filtered key={chip.label} query={query} chip={chip} />
      ) : overview.error ? (
        <ErrorBox error={overview.error} onRetry={overview.reload} />
      ) : overview.loading || !overview.data ? (
        <Loading variant="list" label="Searching" />
      ) : (
        <Overview res={overview.data} />
      )}
    </>
  );
}
