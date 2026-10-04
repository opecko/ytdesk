import { create } from "zustand";

/** Playback clock, kept apart from the player store so time ticks only re-render the progress bar. */
export const useProgress = create<{ position: number; duration: number }>(() => ({ position: 0, duration: 0 }));
