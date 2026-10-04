import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ytdlpInstall, ytdlpSetPath, ytdlpStatus, ytdlpUpdate } from "../api/ytdlp";
import { invoke } from "@tauri-apps/api/core";
import AutoplayToggle from "../components/AutoplayToggle";
import Switch from "../components/Switch";
import { ErrorBox, Loading } from "../components/Status";
import { useAsync } from "../hooks/useData";
import { useSettings } from "../stores/settings";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 text-sm">
      <span className="w-32 shrink-0 text-[var(--text-2)]">{label}</span>
      <span className="min-w-0 flex-1 select-text break-all">{children}</span>
    </div>
  );
}

function FlagSetting({ id, get, set, title, detail }: { id: string; get: string; set: string; title: string; detail: string }) {
  const flag = useAsync(id, () => invoke<boolean>(get));
  const [busy, setBusy] = useState(false);
  const change = async (enabled: boolean) => {
    setBusy(true);
    try {
      await invoke(set, { enabled });
    } finally {
      setBusy(false);
      flag.reload();
    }
  };
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{title}</p>
        <p className="text-sm text-[var(--text-2)]">{detail}</p>
      </div>
      <Switch on={flag.data ?? true} onChange={(v) => void change(v)} label={title} disabled={busy || flag.data === undefined} />
    </div>
  );
}

/** yt-dlp fallback settings; mounted only when the Advanced section is open, so its status isn't probed otherwise. */
function YtdlpSettings() {
  const status = useAsync("ytdlp-status", ytdlpStatus);
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setNote(null);
    try {
      const r = await fn();
      setNote({ ok: true, text: typeof r === "string" && r ? r : `${label}: done` });
    } catch (e) {
      setNote({ ok: false, text: String(e) });
    } finally {
      setBusy(null);
      status.reload();
    }
  };

  const s = status.data;
  return (
    <div>
      <h3 className="mb-1 text-base font-semibold">yt-dlp</h3>
      <p className="mb-4 text-sm text-[var(--text-2)]">
        Fallback for resolving audio streams. The app keeps its own up-to-date copy unless you set a path.
      </p>
      {status.error ? <ErrorBox error={status.error} onRetry={status.reload} /> : !s ? <Loading variant="list" /> : (
        <>
          <Row label="Binary">{s.path}{s.managed && <span className="ml-2 text-xs text-[var(--text-3)]">(managed)</span>}</Row>
          <Row label="Version">{s.version ?? <span className="text-[var(--danger)]">not runnable</span>}</Row>
          <Row label="JS runtime">{s.jsRuntime ?? <span className="text-[var(--danger)]">none found: install deno (recommended) or node</span>}</Row>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="chip inline-flex items-center gap-2" disabled={!!busy} onClick={() => run("Install", ytdlpInstall)}>
          <Download size={16} aria-hidden /> {busy === "Install" ? "Downloading…" : "Install / reinstall"}
        </button>
        <button className="chip inline-flex items-center gap-2" disabled={!!busy || !s?.managed} onClick={() => run("Update", ytdlpUpdate)}>
          <RefreshCw size={16} aria-hidden className={busy === "Update" ? "animate-spin" : ""} /> Update (yt-dlp -U)
        </button>
      </div>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run("Save path", () => ytdlpSetPath(path?.trim() || null)); }}>
        <input
          value={path ?? s?.configured ?? ""}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Custom yt-dlp path (empty = managed copy)"
          aria-label="Custom yt-dlp path"
          className="h-10 min-w-0 flex-1 select-text rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[var(--text-3)]"
        />
        <button className="chip h-10" disabled={!!busy}>Save</button>
      </form>
      {note && <p className={`mt-3 select-text whitespace-pre-wrap text-xs ${note.ok ? "text-[var(--text-2)]" : "text-[var(--danger)]"}`}>{note.text}</p>}
    </div>
  );
}

function HistorySetting() {
  const { saveHistory, set } = useSettings();
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-sm text-[var(--text-2)]">Save played songs to your YouTube Music history (also improves recommendations).</p>
      <Switch on={saveHistory} onChange={(v) => set({ saveHistory: v })} label="Save listening history" />
    </div>
  );
}

function DiscordSettings() {
  const { discordRpc, discordButton, discordPodcasts, set } = useSettings();
  return (
    <section className="mb-6 rounded-lg bg-[var(--surface-1)] p-6">
      <h2 className="mb-1 text-lg font-semibold">Discord</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">Rich Presence</p>
          <p className="text-sm text-[var(--text-2)]">Show what you're listening to on your Discord profile: song, artist, album, cover and progress.</p>
        </div>
        <Switch on={discordRpc} onChange={(v) => set({ discordRpc: v })} label="Discord Rich Presence" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">"Listen on YouTube Music" button</p>
          <p className="text-sm text-[var(--text-2)]">Lets others open the song you're playing.</p>
        </div>
        <Switch on={discordButton} onChange={(v) => set({ discordButton: v })} label="Listen on YouTube Music button" disabled={!discordRpc} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">Show podcasts</p>
          <p className="text-sm text-[var(--text-2)]">Also show podcast episodes you're listening to. Off by default.</p>
        </div>
        <Switch on={discordPodcasts} onChange={(v) => set({ discordPodcasts: v })} label="Show podcasts on Discord" disabled={!discordRpc} />
      </div>
    </section>
  );
}

function Advanced() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg bg-[var(--surface-1)]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg p-6 text-left hover:bg-[var(--hover)]">
        <span>
          <span className="block text-lg font-semibold">Advanced</span>
          <span className="block text-sm text-[var(--text-2)]">Playback fallback (yt-dlp)</span>
        </span>
        <ChevronDown size={20} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && <div className="px-6 pb-6"><YtdlpSettings /></div>}
    </section>
  );
}

export default function SettingsView() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <section className="mb-6 rounded-lg bg-[var(--surface-1)] p-6">
        <h2 className="mb-1 text-lg font-semibold">Playback</h2>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-2)]">Autoplay similar music when a song, playlist or album ends.</p>
          <AutoplayToggle withLabel={false} />
        </div>
        <HistorySetting />
      </section>
      <section className="mb-6 rounded-lg bg-[var(--surface-1)] p-6">
        <h2 className="mb-1 text-lg font-semibold">Performance</h2>
        <FlagSetting
          id="render-gpu"
          get="render_get_gpu"
          set="render_set_gpu"
          title="Use GPU for rendering"
          detail="Turn off to keep ytdesk off the graphics card. Uses more CPU instead; on most machines leave it on."
        />
        <div className="mt-4">
          <FlagSetting
            id="close-to-tray"
            get="render_get_close_to_tray"
            set="render_set_close_to_tray"
            title="Close to tray"
            detail="The close button hides ytdesk to the system tray and music keeps playing. Quit from the tray menu."
          />
        </div>
      </section>
      <DiscordSettings />
      <Advanced />
    </div>
  );
}
