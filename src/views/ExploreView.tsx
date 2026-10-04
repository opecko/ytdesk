import { getExplore } from "../api/ytm";
import LoadMore from "../components/LoadMore";
import { Shelves } from "../components/Shelves";
import { ErrorBox, Loading } from "../components/Status";
import { usePaged } from "../hooks/useData";

export default function ExploreView() {
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } = usePaged("explore", getExplore);
  if (error && !items) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !items) return <Loading />;
  return (
    <>
      <Shelves shelves={items} />
      <LoadMore active={hasMore && !error} loading={loadingMore} onVisible={loadMore} />
    </>
  );
}
