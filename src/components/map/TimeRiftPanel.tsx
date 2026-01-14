// TIME RIFT V4: Mode "intelligence" ajouté (feature flag gated)
export type HistoryMode = "archives" | "decay" | "thenNow" | "intelligence";

type Props = {
  active: boolean;
  mode: HistoryMode;
  year: number;
  onModeChange: (mode: HistoryMode) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
};

const YEAR_PRESETS = [
  { value: 1990, label: "'90" },
  { value: 2000, label: "'00" },
  { value: 2010, label: "'10" },
  { value: 2020, label: "'20" },
  { value: 2025, label: "NOW" },
];

export default function TimeRiftPanel({
  active,
  mode,
  year,
  onModeChange,
  onYearChange,
  onClose,
}: Props) {
  if (!active) return null;

  return (
    <div className="time-rift-panel">
      <div className="time-rift-header">
        <span className="time-rift-title">🕰️ TIME RIFT</span>
        <button
          type="button"
          className="time-rift-close"
          onClick={onClose}
          aria-label="Close Time Rift"
        >
          ×
        </button>
      </div>

      <div className="time-rift-modes">
        <button
          type="button"
          className={`time-rift-mode ${mode === "archives" ? "active" : ""}`}
          onClick={() => onModeChange("archives")}
          aria-pressed={mode === "archives"}
        >
          📜 ARCHIVES
        </button>
        <button
          type="button"
          className={`time-rift-mode ${mode === "decay" ? "active" : ""}`}
          onClick={() => onModeChange("decay")}
          aria-pressed={mode === "decay"}
        >
          🔥 DECAY
        </button>
        <button
          type="button"
          className={`time-rift-mode ${mode === "thenNow" ? "active" : ""}`}
          onClick={() => onModeChange("thenNow")}
          aria-pressed={mode === "thenNow"}
        >
          ⏳ THEN/NOW
        </button>
      </div>

      <div className="time-rift-slider">
        <label htmlFor="time-rift-year">📅</label>
        <div className="time-rift-presets">
          {YEAR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`time-rift-preset ${year === preset.value ? "active" : ""}`}
              onClick={() => onYearChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span className="time-rift-year-display">{year}</span>
      </div>

      <div className="time-rift-hint">PRO • Accès aux couches d'archives</div>
    </div>
  );
}
