import { register } from "@tauri-apps/plugin-global-shortcut";
import { usePlayer } from "./player";

export async function initMediaKeys() {
  const p = () => usePlayer.getState();
  const bindings: [string, () => void][] = [
    ["MediaPlayPause", () => p().togglePlay()],
    ["MediaTrackNext", () => p().next()],
    ["MediaTrackPrevious", () => p().prev()],
  ];
  for (const [key, action] of bindings) {
    try {
      await register(key, (e) => e.state === "Pressed" && action());
    } catch (e) {
      console.warn(`media key ${key} unavailable:`, e);
    }
  }
}

/** Tray menu ↔ player: menu clicks drive playback; track/playing changes update the menu (deduped). */
export async function initTray() {
  const { listen } = await import("@tauri-apps/api/event");
  const { invoke } = await import("@tauri-apps/api/core");
  const actions: Record<string, () => void> = {
    play: () => usePlayer.getState().togglePlay(),
    next: () => usePlayer.getState().next(),
    prev: () => usePlayer.getState().prev(),
  };
  await listen<string>("tray", (e) => actions[e.payload]?.());
  let last = "";
  const sync = () => {
    const s = usePlayer.getState();
    const t = s.queue[s.index];
    const title = t ? [t.title, t.artists.join(", ")].filter(Boolean).join(" — ") : null;
    const playing = s.status === "playing";
    const key = `${title}|${playing}`;
    if (key === last) return;
    last = key;
    invoke("tray_update", { title, playing }).catch(() => {});
  };
  usePlayer.subscribe(sync);
  sync();
}
