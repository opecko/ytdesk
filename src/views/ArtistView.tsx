import { getArtist } from "../api/ytm";
import PageHeader from "../components/PageHeader";
import { Shelves } from "../components/Shelves";
import { ErrorBox, Loading } from "../components/Status";
import { useAsync } from "../hooks/useData";

export default function ArtistView({ id }: { id: string }) {
  const { data, error, reload } = useAsync(`artist:${id}`, () => getArtist(id));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title={data.title} subtitle={data.subtitle} thumbnail={data.thumbnail} round radio={{ type: "artist", id }} />
      <Shelves shelves={data.shelves} />
    </>
  );
}
