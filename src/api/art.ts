/** Larger artwork for the same image: googleusercontent size suffix, or i.ytimg max-res frame. */
export function hiResArt(url: string | undefined, id?: string): string | undefined {
  if (!url) return undefined;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) return url.replace(/=w\d+-h\d+[^/]*$|=s\d+[^/]*$/, "=w1200-h1200-l90-rj");
  if (/i\.ytimg\.com\/vi\//.test(url) && id) return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  return url;
}

/**
 * Artwork list for the Media Session (→ MPRIS on Linux, SMTC on Windows), largest first with a fallback that always
 * exists (maxresdefault is missing for some videos).
 */
export const maxresUrl = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

export function mediaArtwork(url: string | undefined, id?: string, maxres = false): { src: string; sizes: string; type: string }[] {
  if (!url) return [];
  const out: { src: string; sizes: string; type: string }[] = [];
  if (/googleusercontent\.com|ggpht\.com/.test(url)) {
    out.push({ src: url.replace(/=w\d+-h\d+[^/]*$|=s\d+[^/]*$/, "=w544-h544-l90-rj"), sizes: "544x544", type: "image/jpeg" });
  } else if (/i\.ytimg\.com\/vi\//.test(url) && id) {
    // maxresdefault doesn't exist for every video; the player upgrades to it once it has loaded (see player.ts).
    if (maxres) out.push({ src: maxresUrl(id), sizes: "1280x720", type: "image/jpeg" });
    out.push({ src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" });
  }
  out.push({ src: url, sizes: "120x120", type: "image/jpeg" });
  return out;
}
