# TIME RIFT V4 - Archive Intelligence (Feature Flag)

## 🎯 OBJECTIF

Ajouter mode **INTELLIGENCE** (filtrage smart par ère + overlay persistant) sans casser ARCHIVES/DECAY/THEN-NOW.

**Status:** Feature flag OFF par défaut (activation post-ship v3.0)

---

## 📍 LOCALISATION EXACTE (Code Review)

### État actuel (v3.0):
- **State location:** `src/pages/MapRoute.tsx` lignes 237-239
  ```tsx
  const [historyActive, setHistoryActive] = useState(false);
  const [historyMode, setHistoryMode] = useState<"archives" | "decay" | "thenNow">("archives");
  const [historyYear, setHistoryYear] = useState(2025);
  ```

- **UI Component:** `src/components/map/TimeRiftPanel.tsx`
  - Type: `HistoryMode = "archives" | "decay" | "thenNow"`
  - Props: `mode`, `year`, `onModeChange`, `onYearChange`, `onClose`

- **Mapbox Integration:** `src/pages/MapRoute.tsx` lignes 2318-2390
  - useEffect avec dépendances: `[mapInstance, historyActive, historyMode, historyYear, isPro, ...]`
  - Layer actuelle: `history-decay-layer` (cercles violets, fake heatmap)

- **Data source:** `places` array (ligne 241)
  ```tsx
  const decayGeoJSON = useMemo(() => ({ type: "FeatureCollection", features: places.map(...) }), [places]);
  ```

---

## 🏗️ ARCHITECTURE V4 (Non-Breaking)

### A) Nouveau fichier: `src/utils/timeRiftIntelligence.ts`

**Purpose:** Isoler toute la logique Intelligence (helpers + types)

```typescript
/**
 * TIME RIFT V4 - Archive Intelligence Helpers
 * 
 * Dérive automatiquement les périodes depuis spots Firestore.
 * Aucune archive externe (V5).
 */

import type { Place } from "../services/places";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type EraBucket = 
  | "all"
  | "pre_1980" 
  | "1980_1999" 
  | "2000_2009" 
  | "2010_2015" 
  | "2016_2020" 
  | "2021_plus";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Extrait l'année d'un spot avec fallback robuste.
 * 
 * Ordre de priorité:
 * 1. yearAbandoned (si disponible)
 * 2. yearLastSeen / yearObserved (si disponible)
 * 3. createdAt.year (fallback)
 * 
 * @returns year number ou null si aucune date valide
 */
export function getSpotYear(spot: Place): number | null {
  // Priority 1: yearAbandoned
  if (spot.yearAbandoned && typeof spot.yearAbandoned === "number") {
    return spot.yearAbandoned;
  }

  // Priority 2: yearLastSeen (si tu as ce champ)
  // if (spot.yearLastSeen && typeof spot.yearLastSeen === "number") {
  //   return spot.yearLastSeen;
  // }

  // Priority 3: createdAt fallback
  if (spot.createdAt) {
    try {
      // Si Firestore Timestamp
      if (typeof spot.createdAt === "object" && "toMillis" in spot.createdAt) {
        return new Date(spot.createdAt.toMillis()).getFullYear();
      }
      // Si number (milliseconds)
      if (typeof spot.createdAt === "number") {
        return new Date(spot.createdAt).getFullYear();
      }
    } catch (e) {
      console.warn("[TIME RIFT] Failed to parse createdAt:", e);
    }
  }

  return null;
}

/**
 * Map une année vers un bucket stable.
 * 
 * Buckets fixes (évite UI chaotique):
 * - pre_1980
 * - 1980_1999
 * - 2000_2009
 * - 2010_2015
 * - 2016_2020
 * - 2021_plus
 */
export function getEraBucket(year: number | null): EraBucket {
  if (year === null) return "2021_plus"; // Fallback: spots sans date = récents

  if (year < 1980) return "pre_1980";
  if (year >= 1980 && year <= 1999) return "1980_1999";
  if (year >= 2000 && year <= 2009) return "2000_2009";
  if (year >= 2010 && year <= 2015) return "2010_2015";
  if (year >= 2016 && year <= 2020) return "2016_2020";
  return "2021_plus";
}

/**
 * Label UI pour chaque bucket.
 */
export function bucketLabel(bucket: EraBucket): string {
  switch (bucket) {
    case "all": return "Toutes périodes";
    case "pre_1980": return "Avant 1980";
    case "1980_1999": return "1980-1999";
    case "2000_2009": return "2000-2009";
    case "2010_2015": return "2010-2015";
    case "2016_2020": return "2016-2020";
    case "2021_plus": return "2021+";
  }
}

/**
 * Filtre les spots par bucket.
 * 
 * @param spots - Array de places
 * @param bucket - Bucket cible (ou "all" pour aucun filtre)
 * @returns Spots filtrés
 */
export function filterSpotsByBucket(spots: Place[], bucket: EraBucket): Place[] {
  if (bucket === "all") return spots;

  return spots.filter((spot) => {
    const year = getSpotYear(spot);
    const spotBucket = getEraBucket(year);
    return spotBucket === bucket;
  });
}

/**
 * Génère un GeoJSON depuis spots filtrés (pour Mapbox overlay).
 * 
 * @param spots - Spots filtrés par bucket
 * @returns GeoJSON FeatureCollection avec propriétés enrichies
 */
export function spotsToGeoJSON(spots: Place[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [spot.lng, spot.lat],
      },
      properties: {
        id: spot.id,
        year: getSpotYear(spot),
        eraBucket: getEraBucket(getSpotYear(spot)),
        title: spot.title,
      },
    })),
  };
}
```

---

### B) Modifications de State (MapRoute.tsx)

**Ligne 238: Étendre HistoryMode**
```tsx
// AVANT (v3.0)
const [historyMode, setHistoryMode] = useState<"archives" | "decay" | "thenNow">("archives");

// APRÈS (v4.0)
const [historyMode, setHistoryMode] = useState<"archives" | "decay" | "thenNow" | "intelligence">("archives");
```

**Nouveau state (après ligne 239):**
```tsx
// 🕰️ TIME RIFT V4: Intelligence mode states
const [timeRiftEra, setTimeRiftEra] = useState<EraBucket>("all");
const [timeRiftOverlayEnabled, setTimeRiftOverlayEnabled] = useState(true);
```

---

### C) Nouveau composant UI: `src/components/map/TimeRiftIntelligencePanel.tsx`

**Purpose:** Sous-panel dédié au mode INTELLIGENCE (évite de polluer TimeRiftPanel.tsx)

```tsx
import type { EraBucket } from "../../utils/timeRiftIntelligence";
import { bucketLabel } from "../../utils/timeRiftIntelligence";

type Props = {
  era: EraBucket;
  onEraChange: (era: EraBucket) => void;
  overlayEnabled: boolean;
  onOverlayToggle: () => void;
  isPro: boolean;
};

const ERA_BUCKETS: EraBucket[] = [
  "all",
  "pre_1980",
  "1980_1999",
  "2000_2009",
  "2010_2015",
  "2016_2020",
  "2021_plus",
];

export default function TimeRiftIntelligencePanel({
  era,
  onEraChange,
  overlayEnabled,
  onOverlayToggle,
  isPro,
}: Props) {
  return (
    <div className="time-rift-intelligence">
      <div className="intelligence-header">
        <span className="intelligence-title">🧠 Archive Intelligence</span>
        <span className="intelligence-badge">BETA</span>
      </div>

      {/* Era Pills */}
      <div className="intelligence-eras">
        {ERA_BUCKETS.map((bucket) => {
          // PRO gating: Free users see only "all"
          if (!isPro && bucket !== "all") {
            return (
              <button
                key={bucket}
                type="button"
                className="era-pill locked"
                onClick={() => {
                  // Trigger PRO paywall
                  window.dispatchEvent(
                    new CustomEvent("urbex-nav", { detail: { path: "/pro?src=intelligence" } })
                  );
                }}
              >
                {bucketLabel(bucket)} 🔒
              </button>
            );
          }

          return (
            <button
              key={bucket}
              type="button"
              className={`era-pill ${era === bucket ? "active" : ""}`}
              onClick={() => onEraChange(bucket)}
            >
              {bucketLabel(bucket)}
            </button>
          );
        })}
      </div>

      {/* Overlay Toggle */}
      <div className="intelligence-overlay-toggle">
        <label>
          <input
            type="checkbox"
            checked={overlayEnabled}
            onChange={onOverlayToggle}
          />
          <span>Afficher overlay heatmap</span>
        </label>
      </div>
    </div>
  );
}
```

---

### D) Intégration dans TimeRiftPanel.tsx

**Modifier le type (ligne 1):**
```tsx
// AVANT
type HistoryMode = "archives" | "decay" | "thenNow";

// APRÈS
type HistoryMode = "archives" | "decay" | "thenNow" | "intelligence";
```

**Ajouter props (après ligne 9):**
```tsx
type Props = {
  active: boolean;
  mode: HistoryMode;
  year: number;
  onModeChange: (mode: HistoryMode) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  
  // V4 Intelligence props
  era?: EraBucket;
  onEraChange?: (era: EraBucket) => void;
  overlayEnabled?: boolean;
  onOverlayToggle?: () => void;
  isPro?: boolean;
};
```

**Ajouter bouton mode INTELLIGENCE (après THEN/NOW, ligne ~70):**
```tsx
<button
  type="button"
  className={`time-rift-mode ${mode === "intelligence" ? "active" : ""}`}
  onClick={() => onModeChange("intelligence")}
  aria-pressed={mode === "intelligence"}
>
  <span className="mode-icon">🧠</span>
  <span className="mode-label">INTELLIGENCE</span>
  <span className="mode-badge">BETA</span>
</button>
```

**Conditional render (après year controls, ligne ~85):**
```tsx
{/* V4: Intelligence Sub-Panel */}
{mode === "intelligence" && era && onEraChange && (
  <TimeRiftIntelligencePanel
    era={era}
    onEraChange={onEraChange}
    overlayEnabled={overlayEnabled ?? true}
    onOverlayToggle={onOverlayToggle ?? (() => {})}
    isPro={isPro ?? false}
  />
)}
```

---

### E) Mapbox Overlay (MapRoute.tsx - nouveau useEffect)

**Après le useEffect TIME RIFT actuel (ligne ~2390), ajouter:**

```tsx
// 🕰️ TIME RIFT V4: Intelligence Overlay (create once, update only)
useEffect(() => {
  if (!mapInstance || !historyActive || historyMode !== "intelligence" || !isPro) {
    // Cleanup: Remove Intelligence layers if mode changed
    if (mapInstance?.getSource("uq-time-rift-intelligence")) {
      if (mapInstance.getLayer("time-rift-intelligence-heatmap")) {
        mapInstance.removeLayer("time-rift-intelligence-heatmap");
      }
      if (mapInstance.getLayer("time-rift-intelligence-circles")) {
        mapInstance.removeLayer("time-rift-intelligence-circles");
      }
      mapInstance.removeSource("uq-time-rift-intelligence");
      console.log("[TIME RIFT V4] Intelligence layers removed");
    }
    return;
  }

  // Filter spots by selected era
  const filteredSpots = filterSpotsByBucket(places, timeRiftEra);
  const geoJSON = spotsToGeoJSON(filteredSpots);

  console.log(`[TIME RIFT V4] Intelligence mode: ${timeRiftEra}, spots: ${filteredSpots.length}`);

  // Create source + layers ONCE
  if (!mapInstance.getSource("uq-time-rift-intelligence")) {
    mapInstance.addSource("uq-time-rift-intelligence", {
      type: "geojson",
      data: geoJSON,
    });

    // Heatmap layer (low zoom)
    mapInstance.addLayer({
      id: "time-rift-intelligence-heatmap",
      type: "heatmap",
      source: "uq-time-rift-intelligence",
      maxzoom: 12,
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": 0.6,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(33,102,172,0)",
          0.2, "rgba(103,169,207,0.3)",
          0.4, "rgba(209,229,240,0.5)",
          0.6, "rgba(253,219,199,0.7)",
          0.8, "rgba(239,138,98,0.8)",
          1, "rgba(178,24,43,0.9)"
        ],
        "heatmap-radius": 20,
      },
    });

    // Circle layer (high zoom)
    mapInstance.addLayer({
      id: "time-rift-intelligence-circles",
      type: "circle",
      source: "uq-time-rift-intelligence",
      minzoom: 12,
      paint: {
        "circle-radius": 8,
        "circle-color": uiConfig.accentColor || "#3b82f6",
        "circle-opacity": 0.6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.8,
      },
    });

    console.log("[TIME RIFT V4] Intelligence layers created");
  } else {
    // UPDATE data only (no layer recreation)
    const source = mapInstance.getSource("uq-time-rift-intelligence") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geoJSON);
      console.log("[TIME RIFT V4] Intelligence data updated");
    }
  }

  // Toggle overlay visibility
  if (mapInstance.getLayer("time-rift-intelligence-heatmap")) {
    mapInstance.setLayoutProperty(
      "time-rift-intelligence-heatmap",
      "visibility",
      timeRiftOverlayEnabled ? "visible" : "none"
    );
  }
  if (mapInstance.getLayer("time-rift-intelligence-circles")) {
    mapInstance.setLayoutProperty(
      "time-rift-intelligence-circles",
      "visibility",
      timeRiftOverlayEnabled ? "visible" : "none"
    );
  }
}, [
  mapInstance,
  historyActive,
  historyMode,
  timeRiftEra,
  timeRiftOverlayEnabled,
  isPro,
  places,
  uiConfig.accentColor,
]);
```

---

### F) Wire handlers (MapRoute.tsx)

**Après les handlers existants (ligne ~2450):**

```tsx
// 🕰️ TIME RIFT V4: Intelligence handlers
const handleEraChange = useCallback((era: EraBucket) => {
  setTimeRiftEra(era);
  
  // Tracking (debug only)
  if (import.meta.env.DEV) {
    console.log(`[CONVERSION] time_rift_era_change { era: "${era}" }`);
  }
}, []);

const handleOverlayToggle = useCallback(() => {
  setTimeRiftOverlayEnabled((prev) => !prev);
  
  // Tracking (debug only)
  if (import.meta.env.DEV) {
    console.log(`[CONVERSION] time_rift_overlay_toggle { enabled: ${!timeRiftOverlayEnabled} }`);
  }
}, [timeRiftOverlayEnabled]);
```

**Modifier handleHistoryModeChange (tracking):**
```tsx
const handleHistoryModeChange = useCallback((mode: HistoryMode) => {
  setHistoryMode(mode);
  
  // Tracking (debug only)
  if (import.meta.env.DEV) {
    console.log(`[CONVERSION] time_rift_mode_change { mode: "${mode}" }`);
  }
}, []);
```

---

### G) Passer les props (MapRoute.tsx render, ligne ~2882)

**AVANT:**
```tsx
<TimeRiftPanel
  active={historyActive}
  mode={historyMode}
  year={historyYear}
  onModeChange={handleHistoryModeChange}
  onYearChange={setHistoryYear}
  onClose={handleHistoryToggle}
/>
```

**APRÈS:**
```tsx
<TimeRiftPanel
  active={historyActive}
  mode={historyMode}
  year={historyYear}
  onModeChange={handleHistoryModeChange}
  onYearChange={setHistoryYear}
  onClose={handleHistoryToggle}
  
  // V4 Intelligence props
  era={timeRiftEra}
  onEraChange={handleEraChange}
  overlayEnabled={timeRiftOverlayEnabled}
  onOverlayToggle={handleOverlayToggle}
  isPro={isPro}
/>
```

---

### H) CSS Additions (`src/styles/time-rift.css`)

**Ajouter à la fin du fichier:**

```css
/* ═══════════════════════════════════════════════════════════
   TIME RIFT V4 - INTELLIGENCE MODE
   ═══════════════════════════════════════════════════════════ */

.time-rift-intelligence {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.intelligence-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.intelligence-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.intelligence-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Era Pills */
.intelligence-eras {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.era-pill {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease-out;
}

.era-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
}

.era-pill.active {
  background: rgba(59, 130, 246, 0.3);
  border-color: #3b82f6;
  color: #ffffff;
}

.era-pill.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Overlay Toggle */
.intelligence-overlay-toggle {
  margin-top: 12px;
}

.intelligence-overlay-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.intelligence-overlay-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

/* Mode Badge (for INTELLIGENCE button) */
.time-rift-mode .mode-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  text-transform: uppercase;
  margin-left: 4px;
}
```

---

## 🧪 TESTING CHECKLIST (V4)

### Phase 1: Mode Switch
- [ ] Click INTELLIGENCE mode button
- [ ] Panel affiche "Archive Intelligence" + BETA badge
- [ ] Era pills visibles ("Toutes périodes" selected by default)
- [ ] Switch back to ARCHIVES/DECAY/THEN-NOW → pas de bugs

### Phase 2: Era Filtering
- [ ] Select "1980-1999" → spots filtrés (console log count)
- [ ] Select "2021+" → spots récents uniquement
- [ ] Overlay heatmap visible
- [ ] Free user: eras locked 🔒 → redirect /pro?src=intelligence

### Phase 3: Overlay Performance
- [ ] Layers créés UNE FOIS (console: "Intelligence layers created")
- [ ] Era change → "Intelligence data updated" (pas "created")
- [ ] Toggle overlay OFF → heatmap invisible, circles invisibles
- [ ] Toggle OFF TIME RIFT → layers removed (console: "removed")

### Phase 4: No Regression
- [ ] ARCHIVES mode still works (sepia overlay)
- [ ] DECAY mode still works (violet circles)
- [ ] THEN-NOW mode still works (blue tint)
- [ ] Year slider still works (1990-2025)

---

## 📊 TRACKING EVENTS (V4)

**Nouveaux événements debug:**

```typescript
// time_rift_mode_change
{ mode: "intelligence" }

// time_rift_era_change
{ era: "1980_1999" }

// time_rift_overlay_toggle
{ enabled: false }
```

**Integration dans conversionTracking.ts (optionnel):**

```typescript
export function trackTimeRiftModeChange(mode: string, userId?: string | null) {
  trackConversion("time_rift_mode_change", { mode, userId });
}

export function trackTimeRiftEraChange(era: string, userId?: string | null) {
  trackConversion("time_rift_era_change", { era, userId });
}
```

---

## 🚀 FEATURE FLAG

**Environment variable (`.env`):**
```
VITE_TIME_RIFT_INTELLIGENCE_ENABLED=false
```

**Conditional render (MapRoute.tsx):**
```tsx
// Ne pas afficher bouton INTELLIGENCE si feature flag OFF
{import.meta.env.VITE_TIME_RIFT_INTELLIGENCE_ENABLED === "true" && (
  <button ... INTELLIGENCE button ... />
)}
```

---

## 📝 DEFINITION OF DONE

- [ ] `src/utils/timeRiftIntelligence.ts` créé (helpers + types)
- [ ] `src/components/map/TimeRiftIntelligencePanel.tsx` créé
- [ ] `TimeRiftPanel.tsx` modifié (mode "intelligence" + conditional render)
- [ ] `MapRoute.tsx` state étendu (timeRiftEra, overlayEnabled)
- [ ] Mapbox overlay créé (create once, update only)
- [ ] Handlers wired (handleEraChange, handleOverlayToggle)
- [ ] CSS ajouté (`time-rift.css`)
- [ ] Tracking events (console logs)
- [ ] Feature flag configuré (OFF par défaut)
- [ ] Tests Phase 1-4 passés
- [ ] Zero regression sur modes v3.0
- [ ] Build success (exit 0)

---

**NEXT:** Activer feature flag quand v3.0 shipped + monitoring stable.
