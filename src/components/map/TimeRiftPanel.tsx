// TIME RIFT V4: Mode "intelligence" ajouté (feature flag gated)
export type HistoryMode = "archives" | "decay" | "thenNow" | "intelligence";

// V4: Import types for era control
import type { EraBucket } from "../../utils/timeRiftIntelligence";
import { bucketLabel, isIntelligenceModeEnabled } from "../../utils/timeRiftIntelligence";

type Props = {
  active: boolean;
  mode: HistoryMode;
  year: number;
  onModeChange: (mode: HistoryMode) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  // V4 NEW: Intelligence mode props (optional, feature flag gated)
  era?: EraBucket;
  onEraChange?: (era: EraBucket) => void;
  isPro?: boolean; // For PRO gating (Intelligence chip disabled if false)
};

const YEAR_PRESETS = [
  { value: 1990, label: "'90" },
  { value: 2000, label: "'00" },
  { value: 2010, label: "'10" },
  { value: 2020, label: "'20" },
  { value: 2025, label: "NOW" },
];

// V4: Era buckets for Intelligence mode
const ERA_BUCKETS: EraBucket[] = [
  "all",
  "pre_1980",
  "1980_1999",
  "2000_2009",
  "2010_2015",
  "2016_2020",
  "2021_plus",
];

export default function TimeRiftPanel({
  active,
  mode,
  year,
  onModeChange,
  onYearChange,
  onClose,
  // V4 NEW:
  era = "all",
  onEraChange,
  isPro = false,
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
        {/* V4: INTELLIGENCE chip (feature flag gated, disabled if not PRO) */}
        {isIntelligenceModeEnabled() && (
          <button
            type="button"
            className={`time-rift-mode ${mode === "intelligence" ? "active" : ""} ${!isPro ? "locked" : ""}`}
            onClick={() => isPro && onModeChange("intelligence")}
            aria-pressed={mode === "intelligence"}
            disabled={!isPro}
            title={!isPro ? "Intelligence Mode - PRO uniquement" : "Intelligence Mode - Analyse historique par ère"}
          >
            🧠 INTELLIGENCE {!isPro && "🔒"}
          </button>
        )}
      </div>

      {/* V4: Conditional UI - Era Pills (intelligence) OR Year Slider (other modes) */}
      {mode === "intelligence" ? (
        <div className="time-rift-era-pills">
          {ERA_BUCKETS.map((bucket) => {
            const isDisabled = !isPro && bucket !== "all";
            return (
              <button
                key={bucket}
                type="button"
                className={`era-pill ${era === bucket ? "active" : ""}`}
                disabled={isDisabled}
                onClick={() => onEraChange?.(bucket)}
                aria-pressed={era === bucket}
              >
                {bucketLabel(bucket)}
                {isDisabled && <span className="pro-badge">🔒 PRO</span>}
              </button>
            );
          })}
        </div>
      ) : (
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
      )}

      <div className="time-rift-hint">PRO • Accès aux couches d'archives</div>
    </div>
  );
}
