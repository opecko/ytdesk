import { create } from "zustand";

interface Settings {
  autoplay: boolean;
  /** Discord Rich Presence ("Listening to ytdesk"). */
  discordRpc: boolean;
  /** "Listen on YouTube Music" button in the presence. */
  discordButton: boolean;
  /** Add played songs to the YouTube Music history (also feeds recommendations). */
  saveHistory: boolean;
  /** Playback speed for podcast episodes (music always plays at 1×). */
  podcastSpeed: number;
  /** Show podcast episodes in Discord Rich Presence. */
  discordPodcasts: boolean;
}

const KEY = "settings";
const DEFAULTS: Settings = { autoplay: true, discordRpc: true, discordButton: true, saveHistory: true, podcastSpeed: 1, discordPodcasts: false };

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<Settings & { set: (patch: Partial<Settings>) => void }>((set, get) => ({
  ...read(),
  set: (patch) => {
    set(patch);
    try {
      const { autoplay, discordRpc, discordButton, saveHistory, podcastSpeed, discordPodcasts } = get();
      localStorage.setItem(KEY, JSON.stringify({ autoplay, discordRpc, discordButton, saveHistory, podcastSpeed, discordPodcasts }));
    } catch {
      /* storage unavailable */
    }
  },
}));
