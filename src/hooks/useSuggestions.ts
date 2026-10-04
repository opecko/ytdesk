import { useEffect, useRef, useState } from "react";
import type { Suggestions } from "../api/types";
import { getSearchSuggestions } from "../api/ytm";

const EMPTY: Suggestions = { queries: [], items: [] };

/** Debounced (250 ms) suggestions; responses for anything but the latest input are dropped. */
export function useSuggestions(input: string, enabled: boolean) {
  const [state, setState] = useState<{ data: Suggestions; error?: string }>({ data: EMPTY });
  const seq = useRef(0);
  useEffect(() => {
    const q = input.trim();
    const id = ++seq.current;
    if (!enabled || !q) {
      setState({ data: EMPTY });
      return;
    }
    const t = setTimeout(() => {
      getSearchSuggestions(q).then(
        (data) => id === seq.current && setState({ data }),
        (e) => id === seq.current && setState({ data: EMPTY, error: String(e?.message ?? e) }),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [input, enabled]);
  return state;
}
