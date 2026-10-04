import { invoke } from "@tauri-apps/api/core";
import { buildActivity } from "../api/discord";
import { usePlayer } from "./player";
import { useProgress } from "./progress";
import { useSettings } from "./settings";

// Discord accepts 5 activity updates per 20 s; within that budget updates go out immediately.
const RATE_COUNT = 5;
const RATE_WINDOW_MS = 20_000;
const SEEK_TOLERANCE_S = 3;

/** Mirrors the player into Discord Rich Presence. Clock ticks don't send; only real changes (track, play/pause, seek). */
export function initDiscord() {
  let lastKey = "";
  let sends: number[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Wall-clock ms when the current track would have started, as last reported to Discord. */
  let sentStart = 0;
  let sentDuration = 0;
  let enabled = useSettings.getState().discordRpc;

  const send = () => {
    timer = undefined;
    const { queue, index, status } = usePlayer.getState();
    const { position, duration: clock } = useProgress.getState();
    const track = queue[index];
    sends = [...sends.filter((t) => Date.now() - t < RATE_WINDOW_MS), Date.now()];
    // Podcasts stay private unless "Show podcasts on Discord" is on.
    const hidden = track?.podcast && !useSettings.getState().discordPodcasts;
    if (!track || hidden || status === "idle" || status === "error") {
      lastKey = "none";
      void invoke("discord_set", { activity: null }).catch(() => {});
      return;
    }
    const duration = clock || track.durationSec || 0;
    // A track that is loading is shown as playing right away, so a skip shows up instantly.
    const playing = status === "playing" || status === "loading";
    const activity = buildActivity({ track, playing, position, duration, button: useSettings.getState().discordButton });
    sentStart = Date.now() - position * 1000;
    sentDuration = duration;
    void invoke("discord_set", { activity }).catch(() => {});
  };

  const schedule = () => {
    if (!enabled || timer) return;
    const recent = sends.filter((t) => Date.now() - t < RATE_WINDOW_MS);
    const wait = recent.length < RATE_COUNT ? 0 : recent[0] + RATE_WINDOW_MS - Date.now();
    timer = setTimeout(send, Math.max(0, wait));
  };

  let trackSeen = "";
  let trackSeenAt = 0;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;

  const check = () => {
    if (!enabled) return;
    const { queue, index, status, watch } = usePlayer.getState();
    const track = queue[index];
    if (track && track.id !== trackSeen) {
      trackSeen = track.id;
      trackSeenAt = Date.now();
    }
    // Whether a track is a podcast episode may only be known once /next arrives: wait for it (max 3 s) so a podcast
    // never flashes up on Discord.
    if (track && !track.podcast && watch?.videoId !== track.id && Date.now() - trackSeenAt < 3000) {
      clearTimeout(waitTimer);
      waitTimer = setTimeout(check, 3000 - (Date.now() - trackSeenAt));
      return;
    }
    const shown = status === "loading" ? "playing" : status; // loading → playing: no second update when it starts
    const { discordButton, discordPodcasts } = useSettings.getState();
    const hidden = track?.podcast && !discordPodcasts;
    const key = track && !hidden && status !== "idle" && status !== "error" ? `${track.id}|${shown}|${discordButton}` : "none";
    if (key !== lastKey) {
      lastKey = key;
      return schedule();
    }
    if (status !== "playing") return; // drift/duration re-sync only once audio really runs
    const { position, duration } = useProgress.getState();
    const drift = Math.abs((Date.now() - sentStart) / 1000 - position);
    if (drift > SEEK_TOLERANCE_S || Math.abs(duration - sentDuration) > 2) schedule();
  };

  usePlayer.subscribe(check);
  useProgress.subscribe(check);
  useSettings.subscribe((s) => {
    if (s.discordRpc === enabled) return check();
    enabled = s.discordRpc;
    clearTimeout(timer);
    timer = undefined;
    lastKey = "";
    if (enabled) check();
    else void invoke("discord_disconnect").catch(() => {});
  });
  check();
}
