import {
  Bookmark, BookmarkMinus, Disc3, History, ListEnd, ListPlus, ListStart, Loader2, Pin, PinOff, Radio, Share2, Trash2, User, Users,
} from "lucide-react";
import { useState } from "react";
import type { Item, MenuToggle, Track, TrackMenu } from "../api/types";
import { addToPlaylist, getCredits, getTrackMenu, sendFeedback } from "../api/ytm";
import { useLibrary } from "../stores/library";
import { useNav } from "../stores/nav";
import { usePlayer } from "../stores/player";
import { useToast } from "../stores/toast";
import { useUi } from "../stores/ui";
import Menu, { type MenuEntry } from "./Menu";

const S = 18;
const isMix = (item: Item) => item.type === "playlist" && item.id.startsWith("RD");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Radio source for any item YT Music offers radio on. */
export function radioSource(item: Item) {
  if (item.type === "track") return { type: "song" as const, id: item.id };
  if (item.type === "album") return { type: "album" as const, id: item.id };
  if (item.type === "artist") return { type: "artist" as const, id: item.id };
  return { type: isMix(item) ? ("mix" as const) : ("playlist" as const), id: item.id };
}

function playlistEntries(track: Track): MenuEntry[] {
  const lib = useLibrary.getState();
  if (!lib.playlists) void lib.load();
  return (lib.playlists ?? [])
    .filter((p) => p.id !== "LM" && !p.id.startsWith("RD") && !p.id.startsWith("SE"))
    .map((p) => ({
      label: p.title,
      onSelect: () =>
        addToPlaylist(p.id, track.id).then(
          () => useToast.getState().show(`Saved to "${p.title}"`, "info"),
          (e) => useToast.getState().show(`Could not save to "${p.title}": ${errMsg(e)}`),
        ),
    }));
}

// Toggles flipped this session (feedback token → done), so a reopened menu shows the opposite action.
const flipped = new Set<string>();

function toggleEntry(t: MenuToggle): MenuEntry {
  const on = flipped.has(t.token);
  const label = on ? t.toggledLabel : t.label;
  const token = on ? t.toggledToken : t.token;
  const removes = /^(remove|unpin)/i.test(label);
  const icon = /BOOKMARK/.test(t.icon) ? (removes ? <BookmarkMinus size={S} /> : <Bookmark size={S} />)
    : /KEEP/.test(t.icon) ? (removes ? <PinOff size={S} /> : <Pin size={S} />)
    : <ListPlus size={S} />;
  return {
    label,
    icon,
    onSelect: () =>
      sendFeedback(token).then(
        () => {
          if (on) flipped.delete(t.token);
          else flipped.add(t.token);
          useToast.getState().show(`${label}: done`, "info");
        },
        (e) => useToast.getState().show(`${label} failed: ${errMsg(e)}`),
      ),
  };
}

function openCredits(id: string) {
  const ui = useUi.getState();
  ui.setCredits({ status: "loading" });
  getCredits(id).then(
    (data) => useUi.getState().setCredits({ status: "ok", data }),
    (e) => useUi.getState().setCredits({ status: "error", message: errMsg(e) }),
  );
}

/**
 * Track menu in YouTube Music's order. `menu` = tokens/ids from the list item or fetched via /next on open;
 * `loading` while that fetch runs.
 */
function trackEntries(track: Track, menu: TrackMenu | undefined, loading: boolean, queueIndex?: number): MenuEntry[] {
  const p = usePlayer.getState();
  const go = useNav.getState().go;
  const out: MenuEntry[] = [
    // No song radio for podcast episodes.
    ...(track.podcast ? [] : [{ label: "Start radio", icon: <Radio size={S} />, onSelect: () => void p.startRadio(radioSource(track), track.title) }]),
    { label: "Play next", icon: <ListStart size={S} />, onSelect: () => p.playNext(track) },
    { label: "Add to queue", icon: <ListEnd size={S} />, onSelect: () => p.addToQueue(track) },
    ...(menu?.toggles ?? []).map(toggleEntry),
    { label: "Save to playlist", icon: <ListPlus size={S} />, submenu: () => playlistEntries(track) },
  ];
  if (queueIndex !== undefined)
    out.push({ label: "Remove from queue", icon: <Trash2 size={S} />, onSelect: () => p.removeAt(queueIndex), disabled: queueIndex === p.index });
  const albumId = menu?.albumId ?? track.album?.id;
  if (albumId) out.push({ label: "Go to album", icon: <Disc3 size={S} />, onSelect: () => go({ name: "album", id: albumId }) });
  if (menu?.artistId) out.push({ label: "Go to artist", icon: <User size={S} />, onSelect: () => go({ name: "artist", id: menu.artistId! }) });
  if (menu?.creditsId) out.push({ label: "View song credits", icon: <Users size={S} />, onSelect: () => openCredits(menu.creditsId!) });
  out.push({
    label: "Share",
    icon: <Share2 size={S} />,
    onSelect: () =>
      navigator.clipboard?.writeText(`https://music.youtube.com/watch?v=${track.id}`).then(
        () => useToast.getState().show("Link copied to clipboard", "info"),
        () => useToast.getState().show("Could not copy the link"),
      ),
  });
  const hist = menu?.historyRemoveToken;
  if (hist)
    out.push({
      label: "Remove from history",
      icon: <History size={S} />,
      onSelect: () =>
        sendFeedback(hist).then(
          () => useUi.getState().markRemovedHistory(hist),
          (e) => useToast.getState().show(`Could not remove from history: ${errMsg(e)}`),
        ),
    });
  if (menu?.pin) out.push(toggleEntry(menu.pin));
  if (loading) out.push({ label: "Loading more…", icon: <Loader2 size={S} className="animate-spin" />, disabled: true });
  return out;
}

export function itemEntries(item: Item, opts: { queueIndex?: number; menu?: TrackMenu; loading?: boolean } = {}): MenuEntry[] {
  if (item.type === "track") return trackEntries(item as Track, opts.menu ?? (item as Track).menu, !!opts.loading, opts.queueIndex);
  const p = usePlayer.getState();
  const out: MenuEntry[] = [{ label: "Start radio", icon: <Radio size={S} />, onSelect: () => void p.startRadio(radioSource(item), item.title) }];
  if (item.type === "artist") {
    out.push({ label: "Go to artist", icon: <User size={S} />, onSelect: () => useNav.getState().go({ name: "artist", id: item.id }) });
  }
  return out;
}

/** Tracks without server menu data (album/playlist pages) fetch it via /next when the menu opens. */
export function useTrackMenu(item: Item) {
  const [state, setState] = useState<{ menu?: TrackMenu; loading: boolean }>({ loading: false });
  const load = () => {
    if (item.type !== "track" || (item as Track).menu || state.menu || state.loading) return;
    setState({ loading: true });
    getTrackMenu(item.id).then(
      (menu) => setState({ menu, loading: false }),
      () => setState({ loading: false }),
    );
  };
  return { ...state, load };
}

export default function ItemMenu({ item, queueIndex, className }: { item: Item; queueIndex?: number; className?: string }) {
  const { menu, loading, load } = useTrackMenu(item);
  return (
    <Menu
      entries={() => itemEntries(item, { queueIndex, menu, loading })}
      onOpen={load}
      label={`More actions for ${item.title}`}
      className={className}
    />
  );
}
