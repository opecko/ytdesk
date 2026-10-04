import { create } from "zustand";

type Kind = "error" | "info";

interface ToastState {
  message: string | null;
  kind: Kind;
  show: (message: string, kind?: Kind) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: "error",
  show: (message, kind = "error") => {
    clearTimeout(timer);
    set({ message, kind });
    timer = setTimeout(() => set({ message: null }), kind === "info" ? 3000 : 6000);
  },
}));
