// Parsers for track menus (feedback tokens, credits/artist/album ids) and the song credits dialog.
import { pageType, runsText } from "./raw";
import type { Credits, MenuToggle, TrackMenu } from "./types";

type R = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const arr = (v: unknown): R[] => (Array.isArray(v) ? v : []);
const feedbackToken = (ep: R): string | undefined => ep?.feedbackEndpoint?.feedbackToken;

const PIN_ICONS = /^(KEEP|KEEP_OFF)$/;
// Rating toggles ("Add to liked songs") are handled by the thumbs buttons; downloads are out of scope.
const SKIP_ICONS = /^(FAVORITE|UNFAVORITE|OFFLINE_DOWNLOAD)$/;

function toggle(t: R): MenuToggle | null {
  const token = feedbackToken(t?.defaultServiceEndpoint);
  const toggledToken = feedbackToken(t?.toggledServiceEndpoint);
  const label = runsText(t?.defaultText);
  if (!token || !toggledToken || !label) return null;
  return { label, token, toggledLabel: runsText(t.toggledText) || label, toggledToken, icon: t.defaultIcon?.iconType ?? "" };
}

/** menuRenderer of a list item / queue item → tokens and ids; undefined when nothing useful is there. */
export function parseTrackMenu(menu: R): TrackMenu | undefined {
  const out: TrackMenu = { toggles: [] };
  for (const item of arr(menu?.items)) {
    const tg = item?.toggleMenuServiceItemRenderer;
    if (tg) {
      if (SKIP_ICONS.test(tg.defaultIcon?.iconType ?? "")) continue;
      const t = toggle(tg);
      if (!t) continue;
      if (PIN_ICONS.test(t.icon)) out.pin = t;
      else out.toggles.push(t);
      continue;
    }
    const svc = item?.menuServiceItemRenderer;
    if (svc?.icon?.iconType === "REMOVE_FROM_HISTORY") out.historyRemoveToken = feedbackToken(svc.serviceEndpoint);
    const nav = item?.menuNavigationItemRenderer?.navigationEndpoint;
    const id: string | undefined = nav?.browseEndpoint?.browseId;
    if (!id) continue;
    switch (pageType(nav)) {
      case "MUSIC_PAGE_TYPE_TRACK_CREDITS": out.creditsId = id; break;
      case "MUSIC_PAGE_TYPE_ARTIST":
      case "MUSIC_PAGE_TYPE_USER_CHANNEL": out.artistId ??= id; break;
      case "MUSIC_PAGE_TYPE_ALBUM": out.albumId = id; break;
    }
  }
  const useful = out.toggles.length || out.pin || out.historyRemoveToken || out.creditsId || out.artistId || out.albumId;
  return useful ? out : undefined;
}

/** "View song credits" browse response (a dismissable dialog popup). */
export function parseCredits(data: R): Credits | null {
  const dlg = arr(data?.onResponseReceivedActions)
    .map((a) => a?.openPopupAction?.popup?.dismissableDialogRenderer)
    .find(Boolean);
  if (!dlg) return null;
  const sections = arr(dlg.sections)
    .map((s) => s?.dismissableDialogContentSectionRenderer)
    .filter(Boolean)
    .map((s) => ({ title: runsText(s.title), text: runsText(s.subtitle).trim() }))
    .filter((s) => s.title || s.text);
  return { title: runsText(dlg.title) || "Song credits", sections };
}
