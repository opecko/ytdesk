// Compact "shape" summaries of InnerTube JSON so debugging never needs the full payload.
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const isNode = (k: string) => /(Renderer|ViewModel|Continuation)$/.test(k);
const nodeKey = (o: J): string | undefined => (o && typeof o === "object" ? Object.keys(o).find(isNode) : undefined);

export function textOf(t: J): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  if (t.simpleText) return t.simpleText;
  if (Array.isArray(t.runs)) return t.runs.map((r: J) => r.text).join("");
  if (typeof t.content === "string") return t.content;
  return "";
}

function firstText(o: J, depth = 0): string {
  if (!o || typeof o !== "object" || depth > 6) return "";
  for (const k of ["title", "header", "text", "strapline"]) {
    const s = textOf(o[k]);
    if (s) return s;
  }
  for (const v of Object.values(o)) {
    const s = firstText(v, depth + 1);
    if (s) return s;
  }
  return "";
}

function walk(o: J, fn: (k: string, v: J) => void, depth = 0) {
  if (!o || typeof o !== "object" || depth > 40) return;
  if (Array.isArray(o)) return o.forEach((x) => walk(x, fn, depth + 1));
  for (const [k, v] of Object.entries(o)) {
    fn(k, v);
    walk(v, fn, depth + 1);
  }
}

const MESSAGE_KEYS = /^(messageRenderer|backgroundPromoRenderer|alertRenderer|alertWithButtonRenderer|musicNotifierShelfRenderer|emptyStateRenderer)$/;

function children(body: J): J[] {
  for (const k of ["contents", "items"]) if (Array.isArray(body?.[k])) return body[k];
  return [];
}

export function shape(data: J) {
  const counts: Record<string, number> = {};
  const messages: string[] = [];
  const tabs: string[] = [];
  let sectionList: J[] | null = null;
  walk(data, (k, v) => {
    if (isNode(k)) counts[k] = (counts[k] ?? 0) + 1;
    if (MESSAGE_KEYS.test(k) && messages.length < 5) messages.push(`${k}: ${firstText(v).slice(0, 160)}`);
    if (k === "tabRenderer") tabs.push(textOf(v?.title) || "?");
    if (!sectionList && (k === "sectionListRenderer" || k === "sectionListContinuation") && Array.isArray(v?.contents))
      sectionList = v.contents;
  });
  const sections = (sectionList ?? []).slice(0, 25).map((s: J) => {
    const type = nodeKey(s) ?? "?";
    const body = s[type];
    const kids = children(body);
    const childTypes = [...new Set(kids.map((c: J) => nodeKey(c) ?? "?"))];
    // ItemSection often wraps a Grid / MusicShelf one level down.
    const grand = kids.flatMap((c: J) => children(c?.[nodeKey(c) ?? ""]));
    return {
      type,
      title: firstText(body?.header ?? body?.title ?? {}).slice(0, 60) || undefined,
      items: kids.length,
      childTypes,
      grandChildren: grand.length ? { count: grand.length, types: [...new Set(grand.map((g: J) => nodeKey(g) ?? "?"))] } : undefined,
      hasContinuation: !!(body?.continuations || kids.some((c: J) => nodeKey(c) === "continuationItemRenderer")),
    };
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30);
  return { tabs, sections, messages, nodeTypes: Object.fromEntries(top) };
}

export function errInfo(e: unknown) {
  const err = e as Error;
  const info = (err as { info?: unknown })?.info;
  return { message: String(err?.message ?? e).slice(0, 600), info: info ? String(typeof info === "string" ? info : JSON.stringify(info)).slice(0, 300) : undefined, stack: (err?.stack ?? "").split("\n").slice(1, 6).map((s) => s.trim()) };
}

const DROP = /^(trackingParams|clickTrackingParams|loggingContext|accessibility|accessibilityData|serviceEndpoint|feedbackEndpoint|loggingDirectives|menu|thumbnailCrop|thumbnailScale|commandMetadata|webCommandMetadata)$/;
/** One trimmed example node: arrays cut to 1-2, strings to 24 chars, noise keys dropped. */
export function sample(o: J, depth = 0): J {
  if (depth > 14) return "…";
  if (typeof o === "string") return o.length > 24 ? o.slice(0, 24) + "…" : o;
  if (Array.isArray(o)) return o.slice(0, 2).map((x) => sample(x, depth + 1));
  if (!o || typeof o !== "object") return o;
  return Object.fromEntries(Object.entries(o).filter(([k]) => !DROP.test(k)).map(([k, v]) => [k, sample(v, depth + 1)]));
}

/** Finds the first node of `type` anywhere in the payload. */
export function findNode(o: J, type: string): J {
  let hit: J;
  walk(o, (k, v) => { if (!hit && k === type) hit = v; });
  return hit;
}
