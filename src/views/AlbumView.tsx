import { getAlbum } from "../api/ytm";
import PageHeader from "../components/PageHeader";
import { Shelves } from "../components/Shelves";
import { ErrorBox, Loading } from "../components/Status";
import TrackList from "../components/TrackList";
import { useAsync } from "../hooks/useData";

export default function AlbumView({ id }: { id: string }) {
  const { data, error, reload } = useAsync(`album:${id}`, () => getAlbum(id));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading variant="list" />;
  return (
    <>
      <PageHeader title={data.title} subtitle={data.subtitle} thumbnail={data.thumbnail} tracks={data.tracks} radio={{ type: "album", id }} />
      <TrackList tracks={data.tracks} />
      <div className="mt-8"><Shelves shelves={data.related} /></div>
    </>
  );
}
