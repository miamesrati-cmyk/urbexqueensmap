// TIME RIFT V4: Mode "intelligence" ajouté (feature flag gated)
import { useEffect } from "react";

export type HistoryMode = "archives" | "decay" | "thenNow" | "intelligence";

// V4: Import types for era control
import type { EraBucket } from "../../utils/timeRiftIntelligence";
import { bucketLabel, isIntelligenceModeEnabled } from "../../utils/timeRiftIntelligence";
import type { WikiCard } from "../../services/archives/wiki";

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
  proStatus?: "loading" | "pro" | "free"; // Tri-state for robust PRO gating
  // 📜 ARCHIVES MODE (Option C): Raster controls
  archivesOpacity?: number;
  archivesSource?: "ohm" | "fallback";
  onArchivesOpacityChange?: (opacity: number) => void;
  onArchivesSourceChange?: (source: "ohm" | "fallback") => void;
  // 📜 ARCHIVES: Wikipedia cards + reset
  archiveCards?: WikiCard[];
  archivesLoading?: boolean;
  archivesError?: string | null;
  archivesQueryPoint?: { lat: number; lng: number } | null;
  onArchivesReset?: () => void;
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
  proStatus = "loading",
  // 📜 ARCHIVES MODE (Option C):
  archivesOpacity = 0.55,
  archivesSource = "ohm",
  onArchivesOpacityChange,
  onArchivesSourceChange,
  // 📜 ARCHIVES: Wikipedia cards + reset
  archiveCards = [],
  archivesLoading = false,
  archivesError = null,
  archivesQueryPoint = null,
  onArchivesReset,
}: Props) {
  // Debug: Log when archiveCards prop changes
  // MUST be before early return to respect Rules of Hooks
  useEffect(() => {
    if (import.meta.env.DEV && active) {
      console.log("[ARCHIVES][TimeRiftPanel] Received cards:", archiveCards?.length ?? 0);
    }
  }, [archiveCards, active]);

  // Derive booleans from tri-state for backward compat
  const isPro = proStatus === "pro";
  const isProLoading = proStatus === "loading";

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

      {/* 🎯 Signature clandestine: murmure, pas feature */}
      <div className="time-rift-signature-wrapper">
        <div className="time-rift-signature">Le backroom de la carte.</div>
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
        {/* V4: INTELLIGENCE chip (feature flag gated, disabled if not PRO or loading) */}
        {isIntelligenceModeEnabled() && (
          <button
            type="button"
            className={`time-rift-mode ${mode === "intelligence" ? "active" : ""} ${!isPro || isProLoading ? "locked" : ""}`}
            onClick={() => !isProLoading && isPro && onModeChange("intelligence")}
            aria-pressed={mode === "intelligence"}
            disabled={!isPro || isProLoading}
            title={
              isProLoading 
                ? "Intelligence Mode - Chargement..." 
                : !isPro 
                  ? "Intelligence Mode - PRO uniquement" 
                  : "Intelligence Mode - Analyse historique par ère"
            }
          >
            🧠 INTELLIGENCE {isProLoading ? "⏳" : !isPro ? "🔒" : ""}
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

      {/* 📜 ARCHIVES MODE: Opacity slider + source switch */}
      {mode === "archives" && (
        <div className="archives-controls">
          <div className="archives-control-row">
            <label htmlFor="archives-opacity">Opacité</label>
            <input
              id="archives-opacity"
              type="range"
              min="0"
              max="0.75"
              step="0.05"
              value={archivesOpacity}
              onChange={(e) => onArchivesOpacityChange?.(parseFloat(e.target.value))}
              className="archives-opacity-slider"
            />
            <span className="archives-opacity-value">{Math.round(archivesOpacity * 100)}%</span>
          </div>
          
          <div className="archives-control-row">
            <label>Source</label>
            <div className="archives-source-switch">
              {/* OHM only works in production (CORS issue in localhost) */}
              {import.meta.env.PROD && (
                <button
                  type="button"
                  className={`archives-source-btn ${archivesSource === "ohm" ? "active" : ""}`}
                  onClick={() => onArchivesSourceChange?.("ohm")}
                >
                  Historique
                </button>
              )}
              <button
                type="button"
                className={`archives-source-btn ${archivesSource === "fallback" ? "active" : ""}`}
                onClick={() => onArchivesSourceChange?.("fallback")}
              >
                Papier
              </button>
            </div>
            {import.meta.env.DEV && (
              <small style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                (Mode Historique disponible en production)
              </small>
            )}
          </div>

          {/* Reset button: Clear Wikipedia results */}
          <div className="archives-control-row">
            <button
              type="button"
              className="archives-reset-btn"
              onClick={onArchivesReset}
              disabled={!archivesQueryPoint && !archiveCards?.length}
              title={
                !archivesQueryPoint && !archiveCards?.length
                  ? "Clique sur la carte pour lancer une recherche"
                  : "Remettre à zéro"
              }
            >
              🧹 Reset
            </button>
          </div>
        </div>
      )}

      {/* 📜 ARCHIVES: Wikipedia Cards (auto-populated) */}
      {mode === "archives" && (
        <div className="archives-cards-section">
          {archivesLoading && (
            <div className="archives-loading">Recherche archives...</div>
          )}
          
          {archivesError && (
            <div className="archives-error">{archivesError}</div>
          )}
          
          {!archivesLoading && !archivesError && archiveCards.length === 0 && (
            <div className="archives-hint">
              Clique sur la carte pour découvrir l'histoire autour de ce point.
            </div>
          )}
          
          {archiveCards.length > 0 && (() => {
            // 🔥 Debug: Log what we're actually rendering
            if (import.meta.env.DEV) {
              console.log("[ARCHIVES][UI] Rendering cards list, length =", archiveCards.length);
            }
            return (
              <div className="archives-cards-grid">
                {archiveCards.slice(0, 6).map((card) => (
                <a
                  key={card.pageid}
                  href={card.fullurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="archive-card"
                >
                  {card.thumbnail && (
                    <div className="archive-card-thumbnail">
                      <img src={card.thumbnail.source} alt="" />
                    </div>
                  )}
                  <div className="archive-card-content">
                    <h4 className="archive-card-title">{card.title}</h4>
                    {card.dist !== undefined && (
                      <span className="archive-card-distance">
                        {card.dist < 1000 
                          ? `${Math.round(card.dist)}m` 
                          : `${(card.dist / 1000).toFixed(1)}km`}
                      </span>
                    )}
                    {card.extract && (
                      <p className="archive-card-extract">{card.extract}</p>
                    )}
                  </div>
                  <span className="archive-card-link-icon">→</span>
                </a>
              ))}
            </div>
            );
          })()}
        </div>
      )}

      <div className="time-rift-hint">PRO • Accès aux couches d'archives</div>
    </div>
  );
}
