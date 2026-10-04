import { invoke } from "@tauri-apps/api/core";
import { getClient } from "./client";

export type Codec = "opus" | "aac";
export type StreamSource = "innertube" | "yt-dlp";
export interface Stream {
  url: string;
  source: StreamSource;
  codec: Codec;
  /** Served through the local Rust proxy (see src-tauri/src/proxy.rs). */
  proxied?: boolean;
}

/** Appends a line to debug/playback.log via Rust; never throws. */
export function logPlayback(line: string) {
  invoke("log_playback", { line }).catch(() => {});
}

export async function viaProxy(stream: Stream): Promise<Stream> {
  return { ...stream, url: await invoke<string>("proxy_url", { url: stream.url }), proxied: true };
}

export class UnsupportedCodecError extends Error {
  constructor() {
    super(
      /Linux/.test(navigator.userAgent)
        ? "This WebView cannot decode Opus (webm) or AAC (mp4) audio. Install gstreamer1.0-plugins-good, gstreamer1.0-plugins-bad and gstreamer1.0-libav."
        : "This system cannot decode Opus (webm) or AAC (mp4) audio.",
    );
    this.name = "UnsupportedCodecError";
  }
}

type ClientName = NonNullable<NonNullable<Parameters<Awaited<ReturnType<typeof getClient>>["getBasicInfo"]>[1]>["client"]>;

// dbg stream (2026-10-03): YTMUSIC + JS evaluator resolves in ~0.3 s with Range-able URLs; ANDROID/TV/IOS always fail.
const CLIENTS: ClientName[] = ["YTMUSIC"];
const MIME: Record<Codec, string> = { opus: 'audio/webm; codecs="opus"', aac: 'audio/mp4; codecs="mp4a.40.2"' };
const FORMAT_CODEC: Record<Codec, string> = { opus: "opus", aac: "mp4a" };
const PREFETCH_TTL_MS = 20 * 60 * 1000;

export function supportedCodecs(canPlay: (mime: string) => string = (m) => new Audio().canPlayType(m)): Codec[] {
  return (["opus", "aac"] as Codec[]).filter((c) => canPlay(MIME[c]) !== "");
}

async function viaInnertube(videoId: string, codecs: Codec[]): Promise<Stream> {
  const yt = await getClient();
  const errors: string[] = [];
  for (const client of CLIENTS) {
    try {
      const info = await yt.getBasicInfo(videoId, { client });
      for (const codec of codecs) {
        try {
          const format = info.chooseFormat({ type: "audio", quality: "best", codec: FORMAT_CODEC[codec] });
          const url = await format.decipher(yt.session.player);
          if (url) return { url, source: "innertube", codec };
        } catch (e) {
          errors.push(`${client}/${codec}: ${e}`);
        }
      }
    } catch (e) {
      errors.push(`${client}: ${e}`);
    }
  }
  throw new Error(`innertube: no playable format (${errors.slice(-3).join("; ")})`);
}

async function viaYtdlp(videoId: string, codecs: Codec[]): Promise<Stream> {
  const url = await invoke<string>("ytdlp_stream_url", { videoId, codecs });
  return { url, source: "yt-dlp", codec: codecs[0] };
}

// InnerTube (YTMUSIC, ~0.3 s) first, yt-dlp (~8 s, solves challenges via node/deno) as the fallback.
// `alternate` flips the order for retries after a MediaError.
async function resolve(videoId: string, alternate: boolean): Promise<Stream> {
  const codecs = supportedCodecs();
  if (!codecs.length) throw new UnsupportedCodecError();
  const order = alternate ? [viaYtdlp, viaInnertube] : [viaInnertube, viaYtdlp];
  const errors: string[] = [];
  for (const attempt of order) {
    try {
      return await attempt(videoId, codecs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      logPlayback(`${videoId} ${attempt === viaYtdlp ? "yt-dlp" : "innertube"} failed: ${msg}`);
    }
  }
  throw new Error(errors.join("\n"));
}

let prefetched: { id: string; at: number; promise: Promise<Stream> } | null = null;

export function prefetchStream(videoId: string) {
  if (prefetched?.id === videoId) return;
  const promise = resolve(videoId, false);
  const entry = { id: videoId, at: Date.now(), promise };
  prefetched = entry;
  promise.catch(() => {
    if (prefetched === entry) prefetched = null;
  });
}

export function getStreamUrl(videoId: string, opts: { alternate?: boolean } = {}): Promise<Stream> {
  const hit = prefetched;
  prefetched = null;
  if (!opts.alternate && hit?.id === videoId && Date.now() - hit.at < PREFETCH_TTL_MS) return hit.promise;
  return resolve(videoId, !!opts.alternate);
}

// ---------- podcast video ----------

interface VideoFormat {
  itag: number;
  height?: number;
  fps?: number;
  mime_type: string;
}

/** Video-only stream choice: H.264 (hardware-friendly) up to 720p30, then other H.264, then VP9. */
export function pickVideoFormat<T extends VideoFormat>(formats: T[]): T | undefined {
  const score = (f: T) => {
    const avc = /avc1/.test(f.mime_type) ? 0 : 1;
    const h = f.height ?? 0;
    const fits = h <= 720 && (f.fps ?? 30) <= 30 ? 0 : 1;
    return [avc, fits, -h];
  };
  return [...formats].sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  })[0];
}

/** Video track (no audio) of a podcast episode; the <audio> element keeps playing the sound. */
export async function getVideoStreamUrl(videoId: string): Promise<string> {
  const yt = await getClient();
  const info = await yt.getBasicInfo(videoId, { client: "YTMUSIC" });
  const vids = (info.streaming_data?.adaptive_formats ?? []).filter((f) => f.has_video && !f.has_audio);
  const f = pickVideoFormat(vids);
  if (!f) throw new Error("No video for this episode");
  const url = await f.decipher(yt.session.player);
  if (!url) throw new Error("Could not resolve the video stream");
  return url;
}
