import { create } from "zustand";
import { SNAPSHOT_KEY } from "./queueSnapshot";
import { invoke } from "@tauri-apps/api/core";
import { getCookie, resetClient, setAuthExpiredHandler } from "../api/client";
import { clearDataCache } from "../hooks/useData";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  error: string | null;
  init: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => {
  setAuthExpiredHandler(() => {
    clearDataCache();
    invoke("auth_clear").catch(() => {});
    set({ status: "signedOut", error: "Session expired, please sign in again" });
  });
  return {
  status: "loading",
  error: null,
  init: async () => {
    const cookie = await getCookie().catch(() => null);
    set({ status: cookie ? "signedIn" : "signedOut" });
  },
  login: async () => {
    set({ error: null });
    try {
      await invoke<string>("auth_login");
      resetClient();
      clearDataCache();
      set({ status: "signedIn" });
    } catch (e) {
      set({ error: String(e) });
    }
  },
  logout: async () => {
    await invoke("auth_clear");
    try {
      localStorage.removeItem(SNAPSHOT_KEY); // the saved queue belongs to the signed-out account
    } catch {
      /* storage unavailable */
    }
    resetClient();
    clearDataCache();
    set({ status: "signedOut" });
  },
};
});
