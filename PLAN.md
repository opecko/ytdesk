# ytdesk glow-up plan (Tauri 2 + React + youtubei.js)
Verify each phase: `tsc --noEmit`, vitest, `cargo check` (if Rust), `npm run dbg -- <cmd>`. Commit per phase.

- [x] 0. Debug harness `scripts/dbg.ts` (home | library <tab> | search <q> | suggest <q> | stream <id>) → debug/*.json shape summaries
- [x] 1. Auth + locale: shared `makeYtFetch` (cookie, SAPISIDHASH per host origin, X-Goog-AuthUser), WEB_REMIX → music host; lang cs / CZ
- [x] 2. Library: raw browse (`src/api/raw.ts`, `browse.ts`) + defensive parser; tabs independent; fixtures
- [x] 3. Search: raw /search, top card + type-derived groups, server filter chips, debounced suggestions (stale-safe), TopBar search + avatar
- [x] 4. Playback: yt-dlp first (managed binary, auto-install + weekly -U, path setting, JS runtime detect, temp cookies), InnerTube fallback, proxy retry, full errors + debug/playback.log
- [x] 5. Home parity: raw home/explore/browse, mood chips (re-request with params), shelves w/ Více + arrows, quick-pick grid, card variants + play overlay, sidebar playlists + New playlist
- [x] 6. UI glow-up: lucide icons only, new player bar (isolated clock store + Slider), YTM palette tokens, skeletons, chips, scrollbars, empty/error states

## Notes
- Root cause of "not personalised"/library errors: Origin music.youtube.com vs youtubei.js host www.youtube.com → 400 / anonymous.
- Cookie for dbg: YTM_COOKIE env or `.env.local` (`cd src-tauri && cargo run --example export_cookie` copies it from keyring).
- Brand account: dbg `YTM_AUTHUSER=n`; app `setAuthUser(n)`.
- Playback (dbg 2026-10-03): apt yt-dlp 2024.04 fails; standalone 2026.08 + node + cookies works (~7-8 s, JS challenge solve),
  googlevideo URL answers 206 to plain Range GET. InnerTube: ANDROID no URL, IOS 400, TV UNPLAYABLE, YTMUSIC needs JS eval.
  <audio> on WebKitGTK still unverified → MediaError ladder: same URL via proxy (src-tauri/src/proxy.rs) → other resolver.
- Toolchain: node via nvm (~/.nvm/versions/node/v22.*), cargo via ~/.cargo/bin (system cargo 1.75 too old).

# Queue / radio / autoplay / Now Playing
- [x] 1. Chips: raw /next parser `src/api/queue.ts` (chips, panel, continuation, header, automix, lyrics/related tabs); store refreshes per track
- [x] 2. Radio: `startRadio(source)` (page-header RD… endpoint, else RDAMVM/RDAMPL), ⋮ menus everywhere, Radio buttons, load-more ≤3 left; queue now in play order
- [x] 3. Autoplay (default on, Settings + Up next switch): lone song → RDAMVM radio; ≤1 left → YTM automix seed else last-track radio; dedupe vs queue + 50 history; retry once
- [x] 4. Now Playing overlay (above content, below player bar): art + Up next / Related / Lyrics tabs, blurred crossfade bg, Esc/chevron
  dbg tabs: /next tabs = Up next, Komentáře, Související (MPTRt…, root sectionList); no lyrics tab seen → Texty shows only if offered
- dbg chips (2026-10-03): chips only on radio queues (RDAMVM…); none for LM, public PL…, album OLAK…; chip endpoint =
  queueUpdateCommand.fetchContentsCommand.watchEndpoint {playlistId, params} (no videoId), response starts with current track.
  dbg radio: song/mix fallback ids work; playlist, LM, album (→RDAMPLOLAK…), artist (→RDAO…) via page header. All 24-50 tracks + continuation.
  Album / bare-video queues carry automixPreviewVideoRenderer → watchPlaylistEndpoint RDAMPL… (YTM autoplay seed).
- Perf/English pass: hl=en; YTMUSIC+JS eval resolver (0.3 s vs yt-dlp 8 s); clock 1 Hz + paused when hidden; cheap blur;
  no content-visibility; plain <img>; hover prefetch; hover-only scrollbars with stable gutter.

# Queue history + podcasts
- [x] 1. Queue shows played tracks (dimmed), keeps current 1st/2nd in view, Autoplay divider line, drag handle reorder
- [x] 2. Podcast playback: speed, −10/+30 s, no Discord unless enabled in Settings
- [x] 3. Podcast views: show page (episodes + filters), channel page (latest episodes)
- [x] 4. Audio/Video toggle for podcast episodes only
