import { getBrowse } from "../api/ytm";
import LoadMore from "../components/LoadMore";
import { Shelves } from "../components/Shelves";
import { EmptyState, ErrorBox, Loading } from "../components/Status";
import { usePaged } from "../hooks/useData";

/** Generic browse page: shelf "More" targets, mood/genre categories. */
export default function BrowseView({ browseId, params, title }: { browseId: string; params?: string; title?: string }) {
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } = usePaged(
    `browse:${browseId}:${params ?? ""}`,
    () => getBrowse({ browseId, params }),
  );
  return (
    <>
      {title && <h1 className="mb-8 text-3xl font-bold tracking-tight">{title}</h1>}
      {error && !items ? <ErrorBox error={error} onRetry={reload} /> : loading || !items ? <Loading variant="grid" /> : (
        <>
          {items.length === 0 && <EmptyState title="Nothing here" />}
          <Shelves shelves={items.map((s, i) => (i === 0 && title && s.title === title ? { ...s, title: "" } : s))} />
          {error && <ErrorBox error={error} onRetry={loadMore} />}
          <LoadMore active={hasMore && !error} loading={loadingMore} onVisible={loadMore} />
        </>
      )}
    </>
  );
}
