import { create } from "zustand";
import type { Item } from "../api/types";
import { createPlaylist, getLibrary } from "../api/ytm";

interface LibraryState {
  playlists: Item[] | null;
  error: string | null;
  load: () => Promise<void>;
  create: (title: string) => Promise<string | undefined>;
}

let inflight: Promise<void> | null = null;

/** Sidebar playlist list (all pages of the Library "Playlists" tab). */
export const useLibrary = create<LibraryState>((set, get) => ({
  playlists: null,
  error: null,
  load: () =>
    (inflight ??= (async () => {
      try {
        let page = await getLibrary("playlists");
        const all = [...page.items];
        for (let i = 0; page.loadMore && i < 20; i++) {
          page = await page.loadMore();
          all.push(...page.items);
        }
        set({ playlists: all, error: null });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        inflight = null;
      }
    })()),
  create: async (title) => {
    const id = await createPlaylist(title);
    await get().load();
    return id;
  },
}));
