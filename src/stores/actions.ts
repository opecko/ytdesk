import type { Item } from "../api/types";
import { getAlbum, getArtist, getPlaylist } from "../api/ytm";
import { prefetch } from "../hooks/useData";
import { openItem } from "./nav";
import { usePlayer } from "./player";
import { useToast } from "./toast";

/** Card/row click: tracks start a radio, everything else navigates. */
export function activateItem(item: Item) {
  // Episodes play on their own (no song radio); everything else track-like starts a radio.
  if (item.type === "track" && item.podcast) usePlayer.getState().playQueue([item], 0, { title: item.title });
  else if (item.type === "track") usePlayer.getState().playRadio(item);
  else openItem(item);
}

/** Play overlay: plays an album/playlist from the top without navigating. */
export async function playItem(item: Item) {
  try {
    if (item.type === "track") return usePlayer.getState().playRadio(item);
    if (item.type === "album") return usePlayer.getState().playQueue((await getAlbum(item.id)).tracks, 0, { title: item.title });
    if (item.type === "playlist")
      return usePlayer.getState().playQueue((await getPlaylist(item.id)).tracks, 0, { playlistId: item.id, title: item.title });
    openItem(item);
  } catch (e) {
    useToast.getState().show(`Could not play "${item.title}": ${e instanceof Error ? e.message : e}`);
  }
}

let hoverTimer: ReturnType<typeof setTimeout> | undefined;

/** Hover intent: after a short pause, start loading the page the item opens so the click feels instant. */
export function prefetchItem(item: Item | null) {
  clearTimeout(hoverTimer);
  if (!item || item.type === "track") return;
  hoverTimer = setTimeout(() => {
    if (item.type === "album") prefetch(`album:${item.id}`, () => getAlbum(item.id));
    else if (item.type === "playlist") prefetch(`playlist:${item.id}`, () => getPlaylist(item.id));
    else if (item.type === "artist") prefetch(`artist:${item.id}`, () => getArtist(item.id));
  }, 120);
}
