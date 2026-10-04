// YouTube Music watch history: one authenticated "playback" stats ping per play (verified with dbg: the track then
// shows up under History → Today). The URL comes from the YT Music /player response.

const CPN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

/** Client playback nonce: 16 random URL-safe characters, as the web player generates. */
export function makeCpn(random: () => number = Math.random): string {
  return Array.from({ length: 16 }, () => CPN_ALPHABET[Math.floor(random() * 64)]).join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function historyPingUrl(player: any, cpn: string): string | null {
  const base: unknown = player?.playbackTracking?.videostatsPlaybackUrl?.baseUrl;
  if (typeof base !== "string" || !/^https:\/\/[a-z]+\.youtube\.com\/api\/stats\/playback/.test(base)) return null;
  const url = new URL(base);
  url.searchParams.set("ver", "2");
  url.searchParams.set("c", "WEB_REMIX");
  url.searchParams.set("cpn", cpn);
  return url.toString();
}
