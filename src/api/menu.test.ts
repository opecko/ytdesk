import { describe, expect, it } from "vitest";
import { parseCredits, parseTrackMenu } from "./menu";

const fb = (token: string) => ({ feedbackEndpoint: { feedbackToken: token } });
const nav = (browseId: string, pageType: string) => ({ menuNavigationItemRenderer: { navigationEndpoint: { browseEndpoint: { browseId, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType } } } } } });
const tog = (icon: string, label: string, toggled: string, a: string, b: string) => ({ toggleMenuServiceItemRenderer: {
  defaultIcon: { iconType: icon }, defaultText: { runs: [{ text: label }] }, toggledText: { runs: [{ text: toggled }] },
  defaultServiceEndpoint: fb(a), toggledServiceEndpoint: fb(b) } });

describe("parseTrackMenu", () => {
  it("collects toggles, pin, history removal and navigation ids; skips likes and downloads", () => {
    const menu = { items: [
      { menuNavigationItemRenderer: { text: { runs: [{ text: "Start mix" }] }, navigationEndpoint: { watchEndpoint: {} } } },
      tog("BOOKMARK_BORDER", "Save to library", "Remove from library", "LIB+", "LIB-"),
      tog("FAVORITE", "Add to liked songs", "Remove from liked songs", "L+", "L-"),
      { menuServiceItemDownloadRenderer: {} },
      nav("MPREalbum", "MUSIC_PAGE_TYPE_ALBUM"),
      nav("UCartist", "MUSIC_PAGE_TYPE_ARTIST"),
      nav("MPTCx", "MUSIC_PAGE_TYPE_TRACK_CREDITS"),
      { menuServiceItemRenderer: { icon: { iconType: "REMOVE_FROM_HISTORY" }, serviceEndpoint: fb("HIST") } },
      tog("KEEP", "Pin to Listen again", "Unpin from Listen again", "PIN", "UNPIN"),
    ] };
    expect(parseTrackMenu(menu)).toEqual({
      toggles: [{ label: "Save to library", token: "LIB+", toggledLabel: "Remove from library", toggledToken: "LIB-", icon: "BOOKMARK_BORDER" }],
      pin: { label: "Pin to Listen again", token: "PIN", toggledLabel: "Unpin from Listen again", toggledToken: "UNPIN", icon: "KEEP" },
      historyRemoveToken: "HIST", creditsId: "MPTCx", artistId: "UCartist", albumId: "MPREalbum",
    });
  });
  it("returns undefined for empty or garbage menus", () => {
    expect(parseTrackMenu({ items: [{ menuServiceItemDownloadRenderer: {} }] })).toBeUndefined();
    expect(parseTrackMenu(null)).toBeUndefined();
  });
});

it("parses the credits dialog", () => {
  const d = { onResponseReceivedActions: [{ openPopupAction: { popup: { dismissableDialogRenderer: {
    title: { runs: [{ text: "Song credits" }] },
    sections: [
      { dismissableDialogContentSectionRenderer: { title: { runs: [{ text: "Performed by" }] }, subtitle: { runs: [{ text: "Pink Floyd" }] } } },
      { dismissableDialogContentSectionRenderer: { title: { runs: [{ text: "Written by" }] }, subtitle: { runs: [{ text: "David Gilmour" }, { text: "\n" }] } } },
    ] } } } }] };
  expect(parseCredits(d)).toEqual({ title: "Song credits", sections: [{ title: "Performed by", text: "Pink Floyd" }, { title: "Written by", text: "David Gilmour" }] });
  expect(parseCredits({})).toBeNull();
});
