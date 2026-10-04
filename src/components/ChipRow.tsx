import type { Chip } from "../api/types";

/** Horizontally scrolling chip row with edge fades. */
export default function ChipRow({ chips, isActive, onPick, label }: {
  chips: Chip[];
  isActive: (c: Chip) => boolean;
  onPick: (c: Chip) => void;
  label: string;
}) {
  if (!chips.length) return null;
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="no-scrollbar -mx-2 mb-8 flex gap-3 overflow-x-auto scroll-smooth px-2 py-1"
      style={{ maskImage: "linear-gradient(90deg, transparent 0, #000 8px, #000 calc(100% - 24px), transparent 100%)" }}
    >
      {chips.map((c) => (
        <button key={c.label} className="chip" aria-pressed={isActive(c)} onClick={() => onPick(c)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
