export function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    if (name) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function hasAuthCookie(header: string): boolean {
  return !!parseCookie(header).SAPISID;
}

export async function sapisidHash(sapisid: string, origin: string, nowSec = Math.floor(Date.now() / 1000)) {
  const data = new TextEncoder().encode(`${nowSec} ${sapisid} ${origin}`);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `SAPISIDHASH ${nowSec}_${hex}`;
}

/** Netscape cookies.txt for yt-dlp --cookies (mirrors `netscape_cookies` in src-tauri/src/ytdlp.rs). */
export function netscapeCookies(header: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const expiry = nowSec + 30 * 24 * 3600;
  const lines = Object.entries(parseCookie(header)).map(
    ([name, value]) => [".youtube.com", "TRUE", "/", name.startsWith("__Secure-") || name.startsWith("__Host-") ? "TRUE" : "FALSE", expiry, name, value].join("\t"),
  );
  return ["# Netscape HTTP Cookie File", ...lines, ""].join("\n");
}
