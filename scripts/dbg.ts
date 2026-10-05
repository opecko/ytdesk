// Debug harness: `npx tsx scripts/dbg.ts <home|library <tab>|search <q>|stream <id>|suggest <q>>`
// Writes debug/<name>.json with only errors + shape summaries. Never prints the cookie.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { LIBRARY_BROWSE, account as parseAccountFn, browse, libraryPage, searchPage, suggestions, type Exec } from "../src/api/browse";
import { createInnertube, loggedInFlag, makeYtFetch } from "../src/api/innertube";
import { fetchChipTracks, fetchNext, startRadio, type RadioSource } from "../src/api/queue";
import type { LibrarySection } from "../src/api/types";
import { errInfo, findNode, sample, shape } from "./shape";

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function loadCookie(): string | null {
  if (process.env.YTM_COOKIE) return process.env.YTM_COOKIE;
  if (!existsSync(".env.local")) return null;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*YTM_COOKIE\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^(['"])(.*)\1$/, "$2");
  }
  return null;
}

// YTM_ANON=1: no cookie at all (stands in for an account without Premium when testing playback).
const cookie = process.env.YTM_ANON ? "" : loadCookie();
if (cookie === null) {
  console.error("No cookie: set YTM_COOKIE or put YTM_COOKIE=... into .env.local (gitignored).");
  process.exit(2);
}

const authUser = Number(process.env.YTM_AUTHUSER ?? 0);
const statuses: string[] = [];
const ytFetch = makeYtFetch(fetch, {
  cookie: () => cookie || null,
  authUser: () => authUser,
  onResponse: (r) => { if (!r.ok) statuses.push(`${r.status} ${r.url.split("?")[0]}`); },
});

function out(name: string, data: J) {
  mkdirSync("debug", { recursive: true });
  writeFileSync(`debug/${name}.json`, JSON.stringify({ ...data, httpErrors: statuses.slice(0, 5) }, null, 1));
  console.log(`wrote debug/${name}.json`);
}

async function step<T>(fn: () => Promise<T>): Promise<T | { error: ReturnType<typeof errInfo> }> {
  try {
    return await fn();
  } catch (e) {
    return { error: errInfo(e) };
  }
}

const yt = await createInnertube(ytFetch, cookie || "", authUser);
const raw = async (endpoint: string, args: J) =>
  ((await yt.actions.execute(endpoint, { ...args, client: "YTMUSIC", parse: false })) as J).data;

async function account() {
  const a = await parseAccountFn(exec);
  return { accountName: !!a?.name, handle: !!a?.handle, photo: !!a?.photo };
}

const sumPage = (p: Awaited<ReturnType<typeof browse>>) => ({
  chips: p.chips.map((c) => `${c.label}${c.browse?.params ? "*" : ""}${c.selected ? "(sel)" : ""}`),
  shelves: p.shelves.map((x) => `${x.title} [${x.layout}${x.compact ? ",compact" : ""}${x.more ? `,more=${x.more.browseId}` : ""}${x.strapline ? `,strap=${x.strapline}` : ""}] ${x.items.length}: ${[...new Set(x.items.map((i) => `${i.type}/${i.art ?? "sq"}`))].join(",")}`),
  messages: p.messages,
  hasNext: !!p.next,
});

const [cmd, ...rest] = process.argv.slice(2);
const arg = rest.join(" ");

const exec: Exec = raw;
const BROWSE: Record<string, string> = LIBRARY_BROWSE;

switch (cmd) {
  case "home": {
    const rawRes = await step(async () => {
      const d = await raw("/browse", { browseId: "FEmusic_home" });
      return { logged_in: loggedInFlag(d), ...shape(d) };
    });
    const sum = sumPage;
    const parsed = await step(async () => {
      const p1 = await browse(exec, { browseId: "FEmusic_home" });
      const p2 = p1.next ? await browse(exec, { continuation: p1.next }) : null;
      const chip = p1.chips.find((c) => c.browse?.params);
      const filtered = chip ? await browse(exec, chip.browse!) : null;
      return { page1: sum(p1), page2: p2 && sum(p2), chip: chip?.label, filtered: filtered && sum(filtered) };
    });
    out("home", { account: await step(account), raw: { logged_in: (rawRes as J).logged_in, error: (rawRes as J).error, sections: (rawRes as J).sections?.length }, parsed });
    break;
  }
  case "library": {
    const id = BROWSE[arg];
    if (!id) throw new Error(`tab must be one of ${Object.keys(BROWSE)}`);
    const rawRes = await step(async () => {
      const d = await raw("/browse", { browseId: id });
      const p = await libraryPage(exec, arg as LibrarySection);
      const c = p.next ? await raw("/browse", { continuation: p.next }) : null;
      return { logged_in: loggedInFlag(d), ...shape(d), continuation: c && { keys: Object.keys(c), ...shape(c) } };
    });
    const parsed = await step(async () => {
      const p1 = await libraryPage(exec, arg as LibrarySection);
      const p2 = p1.next ? await libraryPage(exec, arg as LibrarySection, p1.next) : null;
      const types = (p: typeof p1) => [...new Set(p.items.map((i) => `${i.type}/${i.art ?? "square"}`))];
      return {
        page1: { count: p1.items.length, types: types(p1), messages: p1.messages, hasNext: !!p1.next, first: p1.items[0] && { ...p1.items[0], thumbnail: !!p1.items[0].thumbnail } },
        page2: p2 && { count: p2.items.length, types: types(p2), hasNext: !!p2.next },
      };
    });
    out(`library-${arg}`, { browseId: id, raw: rawRes, parsed });
    break;
  }
  case "search": {
    const rawRes = await step(async () => {
      const d = await raw("/search", { query: arg });
      return { logged_in: loggedInFlag(d), ...shape(d) };
    });
    const sum = (r: Awaited<ReturnType<typeof searchPage>>) => ({
      top: r.top.map((i) => `${i.type}:${i.title}${"explicit" in i && i.explicit ? " [E]" : ""}`),
      topActions: r.topActions.map((a) => `${a.kind}:${a.label}:${a.playlistId ?? a.videoId ?? "-"}${a.params ? "+params" : ""}`),
      shelves: r.shelves.map((x) => `${x.title}(${x.items.length})`),
      groups: r.groups.map((g) => `${g.id}(${g.items.length}): ${g.items.slice(0, 2).map((i) => i.title).join(" | ")}`),
      chips: r.chips.map((c) => `${c.label}${c.searchParams ? "*" : ""}`),
      messages: r.messages,
      hasNext: !!r.next,
    });
    const parsed = await step(async () => {
      const all = await searchPage(exec, arg);
      const chip = all.chips.find((c) => c.searchParams) ;
      const filtered = chip ? await searchPage(exec, arg, chip.searchParams) : null;
      const more = filtered?.next ? await searchPage(exec, arg, chip!.searchParams, filtered.next) : null;
      return { all: sum(all), filteredBy: chip?.label, filtered: filtered && sum(filtered), more: more && sum(more) };
    });
    out("search", { query: arg, raw: { logged_in: (rawRes as J).logged_in, error: (rawRes as J).error }, parsed });
    break;
  }
  case "topplay": {
    // topplay <query>: runs every top-card Shuffle/Mix action through startRadio.
    const res = await searchPage(exec, arg);
    const runs = [];
    for (const a of res.topActions.filter((x) => x.playlistId)) {
      runs.push(await step(async () => {
        const q = await startRadio(exec, { type: "mix", id: a.playlistId!, params: a.params });
        return { action: a.kind, tracks: q.tracks.length, first: q.tracks.slice(0, 3).map((t) => `${t.title} - ${t.artists[0] ?? ""}`), title: q.title };
      }));
    }
    out("topplay", { query: arg, runs });
    break;
  }
  case "card": {
    // Search top-result card: buttons, subtitle and inline items, without the whole response.
    const d = await raw("/search", { query: arg });
    const card = findNode(d, "musicCardShelfRenderer") as J;
    const ep = (e: J) => e && Object.fromEntries(Object.entries(e).filter(([k]) => /Endpoint$/.test(k)).map(([k, v]: [string, J]) =>
      [k, { playlistId: v.playlistId, videoId: v.videoId, params: v.params ? "yes" : undefined, browseId: v.browseId }]));
    out("card", {
      query: arg,
      keys: card && Object.keys(card),
      title: card?.title?.runs?.map((r: J) => ({ text: r.text, nav: ep(r.navigationEndpoint) })),
      subtitle: card?.subtitle?.runs?.map((r: J) => r.text).join(""),
      thumbnail: card && Object.keys(card.thumbnail ?? {}),
      buttons: card?.buttons?.map((b: J) => ({ text: b.buttonRenderer?.text?.runs?.[0]?.text, icon: b.buttonRenderer?.icon?.iconType, cmd: ep(b.buttonRenderer?.command) })),
      onTap: ep(card?.onTap),
      menu: !!card?.menu,
      contents: card?.contents?.map((c: J) => Object.keys(c)[0]),
    });
    break;
  }
  case "chips": {
    // chips <videoId> [playlistId] : raw /next queue header summary
    const [videoId, playlistId] = rest;
    const res = await step(async () => {
      const d = await raw("/next", { videoId, playlistId, isAudioOnly: true });
      const tabs = d?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs ?? [];
      const queue = tabs[0]?.tabRenderer?.content?.musicQueueRenderer;
      const cloud = queue?.subHeaderChipCloud?.chipCloudRenderer;
      const panel = queue?.content?.playlistPanelRenderer;
      return {
        logged_in: loggedInFlag(d),
        tabs: tabs.map((t: J) => `${t?.tabRenderer?.title ?? "?"}:${Object.keys(t?.tabRenderer?.endpoint ?? t?.tabRenderer?.content ?? {}).join("|")}`),
        queueKeys: queue && Object.keys(queue),
        subHeaderChipCloud: !!cloud,
        chips: (cloud?.chips ?? []).map((c: J) => {
          const r = c?.chipCloudChipRenderer;
          const ep = r?.navigationEndpoint;
          const inner = ep?.queueUpdateCommand?.fetchContentsCommand;
          return { label: r?.text?.runs?.map((x: J) => x.text).join(""), endpointKeys: ep && Object.keys(ep), inner: inner && Object.keys(inner), watchKeys: inner?.watchEndpoint && Object.keys(inner.watchEndpoint), selected: r?.isSelected };
        }),
        panel: panel && { playlistId: panel.playlistId, title: panel.title?.runs?.[0]?.text ?? panel.title, count: panel.contents?.length, itemTypes: [...new Set((panel.contents ?? []).map((c: J) => Object.keys(c)[0]))], continuations: panel.continuations && Object.keys(panel.continuations[0] ?? {}) },
      };
    });
    const parsed = await step(async () => {
      const r = await fetchNext(exec, { videoId: videoId || undefined, playlistId });
      const chip = r.chips.find((c) => !c.selected);
      const ct = chip ? await fetchChipTracks(exec, chip, videoId) : null;
      const more = r.continuation ? await fetchNext(exec, { continuation: r.continuation }) : null;
      return {
        tracks: r.tracks.length, first: r.tracks.slice(0, 2).map((t) => `${t.title} / ${t.subtitle}`), header: r.header,
        chips: r.chips.map((c) => `${c.label}${c.selected ? "(sel)" : ""}`), automix: !!r.automix, related: !!r.related, lyrics: !!r.lyrics,
        chipTry: chip && { label: chip.label, tracks: ct?.tracks.length, first: ct?.tracks.slice(0, 2).map((t) => t.title), hasCont: !!ct?.continuation },
        continuation: more && { tracks: more.tracks.length, hasNext: !!more.continuation },
      };
    });
    out(`chips-${playlistId ?? "none"}`, { videoId, playlistId, ...res, parsed });
    break;
  }
  case "radio": {
    // radio <song|playlist|album|artist|mix> <id>
    const [type, id] = rest;
    const r = await step(async () => {
      const q = await startRadio(exec, { type, id } as RadioSource);
      return { via: q.via, playlistId: q.playlistId?.slice(0, 16), tracks: q.tracks.length, first: q.tracks.slice(0, 3).map((t) => `${t.id} ${t.title} / ${t.artists.join(", ")} / ${t.album?.title ?? "-"}`), hasCont: !!q.continuation, title: q.title };
    });
    out("radio", { type, id, ...r });
    break;
  }
  case "autoplay": {
    // autoplay <lastVideoId> <playlistId> : compare YTM automix seed vs last-track radio
    const [videoId, playlistId] = rest;
    const r = await step(async () => {
      const w = await fetchNext(exec, { videoId, playlistId });
      const sum = (x: Awaited<ReturnType<typeof fetchNext>>) => ({ tracks: x.tracks.length, first: x.tracks.slice(0, 3).map((t) => t.title), hasCont: !!x.continuation });
      return {
        automix: w.automix ? sum(await fetchNext(exec, w.automix)) : null,
        lastTrackRadio: sum(await fetchNext(exec, { videoId, playlistId: `RDAMVM${videoId}`, params: "wAEB" })),
      };
    });
    out("autoplay", { videoId, playlistId, ...r });
    break;
  }
  case "tabs": {
    // tabs <videoId> : related + lyrics browse pages from /next
    const [videoId] = rest;
    const r = await step(async () => {
      const w = await fetchNext(exec, { videoId });
      const rel = w.related ? await raw("/browse", w.related) : null;
      const lyr = w.lyrics ? await raw("/browse", w.lyrics) : null;
      return {
        related: w.related && { topKeys: Object.keys(rel?.contents ?? {}), shape: shape(rel).sections.map((x: J) => `${x.type}:${x.title}:${x.items}`), parsed: sumPage(await browse(exec, w.related)).shelves },
        lyrics: w.lyrics ? { topKeys: Object.keys(lyr?.contents ?? {}), shape: shape(lyr).sections.map((x: J) => `${x.type}:${x.items}`), messages: shape(lyr).messages } : null,
      };
    });
    out("tabs", { videoId, ...r });
    break;
  }
  case "suggest": {
    const r = await step(async () => {
      const sg = await suggestions(exec, arg);
      return { queries: sg.queries, items: sg.items.map((i) => `${i.type}:${i.title}`) };
    });
    out("suggest", { query: arg, parsed: r });
    break;
  }
  case "visionos": {
    // visionos <videoId>: formats VISIONOS offers and whether each codec's stream is fully served.
    const info = await yt.getBasicInfo(rest[0], { client: "VISIONOS" });
    const audio = (info.streaming_data?.adaptive_formats ?? []).filter((f) => f.has_audio && !f.has_video).map((f) => `${f.itag} ${f.mime_type}`);
    const video = (info.streaming_data?.adaptive_formats ?? []).filter((f) => f.has_video && !f.has_audio).map((f) => `${f.itag} ${f.mime_type.split(";")[0]} ${f.height}p`).slice(0, 6);
    const rows = [];
    for (const [codec, format] of [["opus", "webm"], ["mp4a", "mp4"]]) {
      rows.push(await step(async () => {
        const f = info.chooseFormat({ type: "audio", quality: "best", codec, format });
        const url = (await f.decipher(yt.session.player))!;
        const r = await fetch(url, { headers: { Range: "bytes=0-" } });
        const n = (await r.arrayBuffer()).byteLength;
        return `${codec}: itag=${f.itag} status=${r.status} got=${n} clen=${new URL(url).searchParams.get("clen")}`;
      }));
    }
    out("visionos", { videoId: rest[0], audio, video, rows });
    break;
  }
  case "clients": {
    // clients <videoId>: for every InnerTube client, the best audio format and whether googlevideo serves the whole
    // file to a media-element style request (open range, and a range past the first MB). Run with YTM_ANON=1 to see
    // what an account without Premium gets.
    const names = ["YTMUSIC", "WEB", "MWEB", "ANDROID_VR", "VISIONOS", "YTMUSIC_ANDROID", "TV", "TV_SIMPLY", "TV_EMBEDDED", "WEB_EMBEDDED", "WEB_CREATOR", "IOS", "ANDROID"] as const;
    const head = async (url: string, range: string) => {
      const r = await fetch(url, { headers: { Range: `bytes=${range}` } }).catch(() => null);
      await r?.body?.cancel();
      return r ? r.status : "x";
    };
    const rows: string[] = [];
    for (const client of names) {
      const t0 = Date.now();
      try {
        const info = await yt.getBasicInfo(rest[0], { client });
        const ps = info.playability_status?.status;
        let f;
        try { f = info.chooseFormat({ type: "audio", quality: "best", codec: "opus", format: "webm" }); }
        catch { f = info.chooseFormat({ type: "audio", quality: "best", format: "any" }); }
        const url = await f.decipher(yt.session.player);
        const clen = Number(new URL(url).searchParams.get("clen") ?? 0);
        rows.push(`${client}: ${ps} itag=${f.itag} ${f.mime_type.split(";")[0]} ${Date.now() - t0}ms open=${await head(url, "0-")} mid=${await head(url, `${Math.floor(clen * 0.8)}-${Math.floor(clen * 0.8) + 1023}`)}`);
      } catch (e) {
        rows.push(`${client}: error ${(e as Error).message.slice(0, 90)}`);
      }
    }
    out("clients", { videoId: rest[0], anon: !!process.env.YTM_ANON, rows });
    break;
  }
  case "fetchfull": {
    // fetchfull <videoId> <opus|mp4a>: downloads the stream like a media element would (Range: bytes=0-), saves it
    // to debug/stream.<ext> and reports status, headers and size against clen.
    const codec = rest[1] ?? "opus";
    const info = await yt.getBasicInfo(rest[0], { client: "YTMUSIC" });
    const f = info.chooseFormat({ type: "audio", quality: "best", codec, format: codec === "opus" ? "webm" : "mp4" });
    const url = (await f.decipher(yt.session.player))!;
    const q = new URL(url).searchParams;
    writeFileSync("debug/stream.url", url); // local debug file only (gitignored debug/)
    const r = await fetch(url, { headers: { Range: "bytes=0-" } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = codec === "opus" ? "webm" : "m4a";
    writeFileSync(`debug/stream.${ext}`, buf);
    out("fetchfull", {
      itag: f.itag, status: r.status, ct: r.headers.get("content-type"), cr: r.headers.get("content-range"), len: r.headers.get("content-length"),
      got: buf.length, clen: q.get("clen"), dur: q.get("dur"), length: info.basic_info.duration, title: info.basic_info.title, params: [...q.keys()].join(","), c: q.get("c"), file: `debug/stream.${ext}`,
    });
    break;
  }
  case "codecs": {
    // codecs <videoId>: what the app's YTMUSIC path picks per codec, and whether googlevideo serves it.
    const { probe } = await import("./dbgStream");
    const info = await yt.getBasicInfo(arg, { client: "YTMUSIC" });
    const rows = [];
    for (const codec of ["opus", "mp4a"]) {
      rows.push(await step(async () => {
        const f = info.chooseFormat({ type: "audio", quality: "best", codec, format: codec === "opus" ? "webm" : "mp4" });
        const url = await f.decipher(yt.session.player);
        return { codec, itag: f.itag, mime: f.mime_type, bitrate: f.bitrate, drc: (f as J).is_drc, xtags: (f as J).xtags, probe: url ? await probe(url) : "no url" };
      }));
    }
    const audio = (info.streaming_data?.adaptive_formats ?? []).filter((f) => f.has_audio && !f.has_video).map((f) => `${f.itag} ${f.mime_type} drc=${(f as J).is_drc ?? "-"}`);
    out("codecs", { videoId: arg, audio, rows });
    break;
  }
  case "stream": {
    const { dbgStream } = await import("./dbgStream");
    out("stream", await dbgStream(yt, arg, cookie));
    break;
  }
  case "browse": {
    // browse <browseId> [params] : parsed shelf summary of any browse page
    const [browseId, params] = rest;
    out(`browse-${browseId}`, await step(async () => sumPage(await browse(exec, { browseId, params }))));
    break;
  }
  case "sample": {
    // sample <browseId> <rendererType> : one trimmed node for writing parsers/fixtures
    const [browseId, type] = rest;
    out(`sample-${type}`, { browseId, node: sample(findNode(await raw("/browse", { browseId }), type)) });
    break;
  }
  default:
    console.error("usage: dbg.ts home | library <playlists|albums|artists|liked> | search <q> | suggest <q> | stream <videoId>");
    process.exit(1);
}
