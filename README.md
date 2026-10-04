# ytdesk

Desktop YouTube Music client: Tauri 2 + React + TypeScript. Custom UI; data from InnerTube via
[youtubei.js](https://github.com/LuanRT/YouTube.js) (no DOM scraping, no hidden music.youtube.com view).

## Requirements (Linux)
- Node 20+, Rust stable (rustup), `yt-dlp` on PATH (playback fallback)
- `libwebkit2gtk-4.1-dev libsoup-3.0-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev`
- Runtime: a Secret Service keyring (gnome-keyring) and GStreamer plugins
  (`gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav`) so WebKitGTK can decode Opus/AAC

## Run / build
```
npm install
npm run tauri dev      # development
npm run tauri build    # bundles in src-tauri/target/release/bundle
npm test && npx tsc --noEmit && (cd src-tauri && cargo test)
```

## Auth
Click **Sign in**: a Google login window opens, cookies for music.youtube.com are saved to the OS keyring.
Dev shortcut: `YTM_COOKIE='SID=…; SAPISID=…; …' npm run tauri dev` (used when the keyring is empty).
A 401 from InnerTube signs you out so you can log in again.

## Config
yt-dlp location: env `YTDLP_PATH`, or `{"ytdlp_path": "/path/to/yt-dlp"}` in `config.json` inside the app config
dir (`~/.config/dev.ytdesk.app/` on Linux). Media keys use global shortcuts (not available on some Wayland setups).
