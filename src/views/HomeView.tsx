import { useState } from "react";
import type { Chip } from "../api/types";
import { getHome } from "../api/ytm";
import ChipRow from "../components/ChipRow";
import LoadMore from "../components/LoadMore";
import { Shelves } from "../components/Shelves";
import { EmptyState, ErrorBox, Loading } from "../components/Status";
import { usePaged } from "../hooks/useData";

let lastChips: Chip[] = [];

export default function HomeView() {
  const [chip, setChip] = useState<Chip | null>(null);
  const { items, chips, loading, error, hasMore, loadingMore, loadMore, reload } = usePaged(
    `home:${chip?.label ?? ""}`,
    () => getHome(chip?.browse),
  );
  // Keep the chip row stable while a filtered feed loads.
  if (chips?.length) lastChips = chips;
  const row = chips?.length ? chips : lastChips;

  return (
    <>
      <ChipRow
        chips={row}
        label="Moods and genres"
        isActive={(c) => c.label === chip?.label}
        onPick={(c) => setChip(c.label === chip?.label ? null : c)}
      />
      {error && !items ? <ErrorBox error={error} onRetry={reload} /> : loading || !items ? <Loading /> : (
        <>
          {items.length === 0 && <EmptyState title="Nothing to show" detail="YouTube Music returned an empty feed." />}
          <Shelves shelves={items} />
          {error && <ErrorBox error={error} onRetry={loadMore} />}
          <LoadMore active={hasMore && !error} loading={loadingMore} onVisible={loadMore} />
        </>
      )}
    </>
  );
}
