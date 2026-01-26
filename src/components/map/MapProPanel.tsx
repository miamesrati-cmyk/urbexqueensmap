import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { MapStyleValue } from "../../services/adminConfigs";
import { trackTimeRiftPaywallOpen } from "../../utils/conversionTracking";

const STYLE_BUTTONS = [
  { value: "night", label: "NIGHT" },
  { value: "satellite", label: "SATELLITE" },
] as const;

// 🚀 Preload Satellite style for instant first switch (ultra-premium)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

/**
 * Intelligent preload: parse style JSON → extract exact sprite URLs
 * Guarantees cache match even if provider changes
 */
async function preloadSatelliteStyle() {
  if (!MAPBOX_TOKEN) return;
  
  const styleJsonUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${MAPBOX_TOKEN}`;
  
  try {
    // 1) Fetch style JSON (warm cache for setStyle call)
    const response = await fetch(styleJsonUrl, { 
      mode: "cors", 
      priority: "low" as any 
    });
    
    if (!response.ok) return;
    
    const styleJson = await response.json();
    
    // 2) Extract exact sprite base URL from style JSON
    const spriteBase = styleJson.sprite;
    if (!spriteBase) return;
    
    // 3) Preload sprite assets (exactly what Mapbox will request)
    const spriteUrls = [
      `${spriteBase}@2x.png`,    // High-DPI sprite image
      `${spriteBase}@2x.json`,   // Sprite metadata
      `${spriteBase}.png`,       // Fallback 1x
    ];
    
    // Fire-and-forget preloads (non-blocking)
    spriteUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
    
    if (import.meta.env.DEV) {
      console.log("[PRELOAD] ✅ Satellite style + sprites warmed", { spriteBase });
    }
  } catch (err) {
    // Silent fail - preload is UX optimization, not critical
    if (import.meta.env.DEV) {
      console.log("[PRELOAD] Failed (non-critical)", err);
    }
  }
}

type Props = {
  styleValue: MapStyleValue;
  onStyleChange: (value: MapStyleValue) => void;
  isStyleSwitching?: boolean; // ✅ Loading state for smooth transition
  epicFilterActive: boolean;
  ghostFilterActive: boolean; // Legacy: true if ghostEchoMode !== "off"
  ghostEchoMode?: "off" | "lite" | "intel"; // ✅ NEW: Ghost Echo tier
  onEpicToggle: () => void;
  onGhostToggle: () => void;
  // 🎯 Nouvelles options PRO
  isProUser?: boolean; // ✅ PRO status for gating
  onUpgradeRequired?: () => void; // ✅ Open paywall/upgrade when non-PRO clicks
  clusteringEnabled?: boolean;
  routePlannerActive?: boolean;
  historyActive?: boolean; // 🕰️ Time Rift mode
  advancedFiltersActive?: boolean;
  onClusterToggle?: () => void;
  onRouteToggle?: () => void;
  onRouteClear?: () => void; // ✅ Clear route without toggling OFF
  onHistoryToggle?: () => void; // 🕰️ Time Rift toggle
  onFiltersToggle?: () => void;
};
export default function MapProPanel({
  styleValue,
  onStyleChange,
  isStyleSwitching = false,
  epicFilterActive,
  ghostFilterActive,
  ghostEchoMode = "off",
  onEpicToggle,
  onGhostToggle,
  isProUser = false,
  onUpgradeRequired,
  clusteringEnabled = false,
  routePlannerActive = false,
  historyActive = false, // 🕰️ Time Rift mode
  advancedFiltersActive = false,
  onClusterToggle,
  onRouteToggle,
  onRouteClear,
  onHistoryToggle, // 🕰️ Time Rift toggle
  onFiltersToggle,
}: Props) {
  const handleStyleClick = (value: MapStyleValue) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (value === styleValue) return;
    
    // 🔒 CRITICAL: Guard Pro-only styles (Satellite)
    if (value === "satellite" && !isProUser) {
      if (import.meta.env.DEV) {
        console.warn("[ACCESS] Satellite style blocked: non-Pro user");
      }
      onUpgradeRequired?.();
      return;
    }
    
    onStyleChange(value);
  };

  const [epicPulse, setEpicPulse] = useState(false);
  const [ghostPulse, setGhostPulse] = useState(false);
  const filterTimersRef = useRef<{
    epic: ReturnType<typeof setTimeout> | null;
    ghost: ReturnType<typeof setTimeout> | null;
  }>({
    epic: null,
    ghost: null,
  });

  // 🚀 Ultra-premium: Preload Satellite style on mount for instant first switch
  useEffect(() => {
    preloadSatelliteStyle();
  }, []);

  useEffect(() => {
    const timers = filterTimersRef.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  const handleEpicFilterClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setEpicPulse(true);
    if (filterTimersRef.current.epic) {
      clearTimeout(filterTimersRef.current.epic);
    }
    filterTimersRef.current.epic = setTimeout(() => setEpicPulse(false), 420);
    onEpicToggle();
  };

  const handleGhostFilterClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setGhostPulse(true);
    if (filterTimersRef.current.ghost) {
      clearTimeout(filterTimersRef.current.ghost);
    }
    filterTimersRef.current.ghost = setTimeout(() => setGhostPulse(false), 420);
    onGhostToggle();
  };

  return (
    <div className="map-pro-panel-compact">
      {STYLE_BUTTONS.map((option) => {
        const isLocked = option.value === "satellite" && !isProUser;
        return (
          <button
            type="button"
            key={option.value}
            data-style={option.value}
            className={`map-pro-pill map-pro-pill--style ${styleValue === option.value ? "is-active" : ""} ${
              isStyleSwitching ? "is-loading" : ""
            } ${isLocked ? "is-locked" : ""}`}
            onClick={handleStyleClick(option.value)}
            aria-pressed={styleValue === option.value}
            aria-label={isLocked ? `${option.label} - Réservé PRO` : option.label}
            disabled={isStyleSwitching}
          >
            {isLocked && <span className="map-pro-pill__lock-icon" aria-hidden="true">👑</span>}
            {option.label}
            {isStyleSwitching && styleValue === option.value && (
              <span className="map-pro-pill__spinner" aria-hidden="true" />
            )}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="filter-epic"
        className={`map-pro-pill map-pro-pill--filter ${epicFilterActive ? "is-active" : ""} ${
          epicPulse ? "is-activating" : ""
        }`}
        onClick={handleEpicFilterClick}
        aria-pressed={epicFilterActive}
        aria-label="Filtrer les spots EPIC"
        title="Afficher les spots EPIC"
      >
        👑 EPIC
      </button>
      <button
        type="button"
        data-testid="filter-ghost"
        className={`map-pro-pill map-pro-pill--filter ${ghostFilterActive ? "is-active" : ""} ${
          ghostPulse ? "is-activating" : ""
        } ${ghostEchoMode === "intel" && isProUser ? "is-pro-mode" : ""}`}
        onClick={handleGhostFilterClick}
        aria-pressed={ghostFilterActive}
        aria-label={
          ghostEchoMode === "intel" 
            ? "Ghost Echo Intel (Pro)" 
            : ghostEchoMode === "lite" 
            ? "Ghost Echo Lite" 
            : "Activer Ghost Echo"
        }
        title={
          ghostEchoMode === "intel" 
            ? "Mode Intel: heatmaps + patterns exploitables" 
            : ghostEchoMode === "lite" 
            ? "Mode Lite: effet cosmétique" 
            : "Activer Ghost Echo"
        }
      >
        👻 GHOST
        {ghostEchoMode === "intel" && <span style={{ marginLeft: "4px", fontSize: "10px" }}>⚡</span>}
        {ghostEchoMode === "lite" && !isProUser && <span style={{ marginLeft: "4px", fontSize: "10px" }}>🌟</span>}
      </button>

      {/* 🎯 Nouvelles options PRO */}
      {onClusterToggle && (
        <button
          type="button"
          data-testid="toggle-clustering"
          className={`map-pro-pill map-pro-pill--feature ${clusteringEnabled ? "is-active" : ""} ${!isProUser ? "is-locked" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            
            // 🔒 GATE: Clustering Pro-only
            if (!isProUser) {
              if (import.meta.env.DEV) {
                console.warn("[ACCESS] Clustering blocked: non-Pro user");
              }
              onUpgradeRequired?.();
              return;
            }
            
            onClusterToggle();
          }}
          disabled={!isProUser}
          aria-pressed={clusteringEnabled}
          aria-label={isProUser ? "Regroupement des spots" : "Clustering - Réservé PRO"}
          title={isProUser ? "Regroupe les lieux proches et révèle l'essentiel" : "Clusters réservés aux explorateurs PRO"}
        >
          {!isProUser && <span className="map-pro-pill__lock-icon">👑</span>}
          🔍 CLUSTER
        </button>
      )}

      {onRouteToggle && (
        <button
          type="button"
          className={`map-pro-pill map-pro-pill--feature ${routePlannerActive ? "is-active" : ""} ${!isProUser ? "is-locked" : ""}`}
          onClick={(e) => {
            // 🔍 DIAGNOSTIC CHECK 1: Prove button receives click
            if (import.meta.env.DEV) {
              console.log("[ROUTE][UI_BUTTON_CLICK]", {
                target: (e.target as HTMLElement)?.tagName,
                current: (e.currentTarget as HTMLElement)?.tagName,
                defaultPrevented: e.defaultPrevented,
              });
            }

            // 🔍 DIAGNOSTIC CHECK 2: Identify top element (overlay detection)
            if (import.meta.env.DEV) {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              console.log("[ROUTE][UI_TOP_ELEMENT]", el, el && (el as HTMLElement).className);
            }

            e.preventDefault();
            if (!isProUser) {
              // ✅ Open upgrade/paywall instead of doing nothing
              if (onUpgradeRequired) {
                onUpgradeRequired();
              }
              return;
            }
            onRouteToggle();
          }}
          aria-pressed={routePlannerActive}
          aria-label="Planificateur d'itinéraire"
          title={isProUser ? "Créer un itinéraire entre spots" : "🔒 Fonctionnalité PRO - Cliquer pour upgrader"}
        >
          📍 ROUTE {!isProUser && "🔒"}
          {routePlannerActive && isProUser && onRouteClear && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation(); // Don't toggle OFF, just clear
                onRouteClear();
              }}
              style={{
                marginLeft: "6px",
                opacity: 0.7,
                cursor: "pointer",
                fontSize: "0.9em",
              }}
              title="Effacer l'itinéraire"
            >
              ×
            </span>
          )}
        </button>
      )}

      {onHistoryToggle && (
        <button
          type="button"
          className={`map-pro-pill map-pro-pill--feature ${historyActive ? "is-active" : ""} ${!isProUser ? "is-locked" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // ✅ Prevent parent click handlers
            // @ts-ignore - stopImmediatePropagation may not exist on all browsers
            e.nativeEvent?.stopImmediatePropagation?.(); // ✅ Block duplicate listeners on same element
            
            if (!isProUser) {
              // 📊 CONVERSION TRACKING: TIME RIFT paywall open
              trackTimeRiftPaywallOpen(null); // TODO: Pass userId from auth context

              // ✨ FUN FACTOR: Time glitch animation before redirect (300ms)
              const btn = e.currentTarget;
              btn.classList.add("is-locked-pulse");
              
              setTimeout(() => {
                btn.classList.remove("is-locked-pulse");
                
                // ✅ PRO conversion: redirect to paywall
                if (onUpgradeRequired) {
                  onUpgradeRequired();
                }
                // Dispatch event for navigation
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("urbex-nav", {
                      detail: { path: "/pro?src=history" },
                    })
                  );
                }
              }, 300);
              
              return;
            }
            onHistoryToggle();
          }}
          aria-pressed={historyActive}
          aria-label="Time Rift - Carte Historique"
          title={isProUser ? "Time Rift : Archive vivante" : "Fonctionnalité PRO - Accès aux couches d'archives"}
        >
          🕰️ TIME RIFT {!isProUser && <span className="pro-badge">PRO</span>}
        </button>
      )}

      {onFiltersToggle && (
        <button
          type="button"
          className={`map-pro-pill map-pro-pill--feature ${advancedFiltersActive ? "is-active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            onFiltersToggle();
          }}
          aria-pressed={advancedFiltersActive}
          aria-label="Filtres avancés"
          title="Filtrer par catégorie, risque, accessibilité"
        >
          🎯 FILTER
        </button>
      )}
    </div>
  );
}
