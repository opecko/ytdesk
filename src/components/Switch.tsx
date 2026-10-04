export default function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative block h-5 w-9 shrink-0 rounded-full p-0 disabled:opacity-50 ${on ? "bg-[var(--accent)]" : "bg-white/25"}`}
    >
      <span className={`absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}
