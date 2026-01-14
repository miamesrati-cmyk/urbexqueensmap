# 🕰️ TIME RIFT — Historical Map Feature (PRO)

## 🎯 CONCEPT
**"Time Rift"** : Une fonctionnalité PRO qui transforme la carte en archive vivante. Les utilisateurs peuvent voyager dans le temps pour voir l'évolution urbaine, les zones d'activité historique, et les spots avec une esthétique "archives cyberpunk".

**Vibe** : Archive glitch, minimal lag, UrbexQueens aesthetic (neon + grain + scanlines)

---

## 🎨 UI/UX DESIGN

### 1. Bouton HISTORY (MapProPanel)
```tsx
// Position : à côté de ROUTE dans le panel PRO
<button className="map-pro-pill map-pro-pill--feature">
  🕰️ HISTORY {!isProUser && "🔒"}
</button>
```

**Comportement** :
- **PRO user** : Ouvre TimeRiftPanel (overlay léger en bas de carte)
- **Non-PRO** : Redirect `/pro?src=history` avec pitch :
  > **"Débloque Time Rift : voyage dans le temps pour voir la carte comme une archive vivante. Zones historiques, heatmap decay, mode Then/Now."**

---

### 2. TimeRiftPanel (Overlay Bottom)
**Design** : Panel horizontal flottant (style neon capsule), 80% largeur, centré en bas (12px margin)

```
┌─────────────────────────────────────────────────────┐
│  🕰️ TIME RIFT                              [×]      │
│  ────────────────────────────────────────────────── │
│  [📜] Archives  [🔥] Decay Heat  [⏳] Then/Now      │
│  ────────────────────────────────────────────────── │
│  📅 1990 ═════●═════════════════════════ 2025       │
│     (slider: année sélectionnée)                    │
└─────────────────────────────────────────────────────┘
```

**Structure** :
```tsx
<div className="time-rift-panel">
  <div className="time-rift-header">
    <span className="time-rift-title">🕰️ TIME RIFT</span>
    <button className="time-rift-close" onClick={onClose}>×</button>
  </div>
  
  <div className="time-rift-modes">
    <button className={`time-rift-mode ${mode === 'archives' ? 'active' : ''}`}>
      📜 Archives
    </button>
    <button className={`time-rift-mode ${mode === 'decay' ? 'active' : ''}`}>
      🔥 Decay Heat
    </button>
    <button className={`time-rift-mode ${mode === 'then-now' ? 'active' : ''}`}>
      ⏳ Then/Now
    </button>
  </div>
  
  <div className="time-rift-slider">
    <label>📅</label>
    <input 
      type="range" 
      min="1990" 
      max={new Date().getFullYear()} 
      value={selectedYear}
      onChange={(e) => setSelectedYear(Number(e.target.value))}
    />
    <span className="time-rift-year">{selectedYear}</span>
  </div>
</div>
```

---

### 3. Overlay Effects (Lightweight)
**Appliqués sur la carte quand Time Rift actif** :

```css
.map-container.time-rift-active::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  
  /* Grain texture (SVG filter, ultra léger) */
  background-image: 
    url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="grain"><feTurbulence baseFrequency="0.8" /></filter><rect width="100%" height="100%" filter="url(%23grain)" opacity="0.05" /></svg>');
  
  /* Scanlines (gradient léger) */
  background-image: 
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.05),
      rgba(0, 0, 0, 0.05) 1px,
      transparent 1px,
      transparent 2px
    );
  
  /* Teinte sépia/bleutée selon mode */
  background-color: rgba(255, 230, 180, 0.08); /* Archives: sépia */
  /* ou */
  background-color: rgba(100, 150, 255, 0.06); /* Then/Now: bleu */
  
  /* Vignette légère */
  box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.3);
  
  mix-blend-mode: multiply;
}
```

**Performance** : CSS only, pas de canvas/WebGL lourd

---

## 🔧 3 MODES DÉTAILLÉS

### Mode 1: 📜 ARCHIVES (Curated Zones + Notes)
**Concept** : Affiche des zones historiques curées (polygones) + petites notes (points)

**Firestore Schema** :
```typescript
// Collection: historical_zones
interface HistoricalZone {
  id: string;
  title: string; // "Ancien site industriel 1985"
  description: string; // "Zone d'activité métallurgique"
  geometry: GeoJSON.Polygon; // Polygone de la zone
  yearStart: number; // 1985
  yearEnd?: number; // 2005 (si zone disparue)
  category: "industrial" | "residential" | "decay" | "abandoned";
  curatedBy: string; // userId de l'admin/curateur
  createdAt: Timestamp;
}

// Collection: historical_notes
interface HistoricalNote {
  id: string;
  title: string; // "Graffiti mural mythique"
  lat: number;
  lng: number;
  year: number; // 1995
  content: string; // "Ce mur a été tagué par..."
  imageUrl?: string; // Photo d'archive (optionnel)
  curatedBy: string;
  createdAt: Timestamp;
}
```

**Mapbox Layers** :
```typescript
// Layer: historical-zones-fill
{
  id: "historical-zones-fill",
  type: "fill",
  source: "historical-zones",
  paint: {
    "fill-color": [
      "match",
      ["get", "category"],
      "industrial", "#FF4A8A", // Rose neon
      "decay", "#A356FF",      // Violet neon
      "abandoned", "#4AF4FF",  // Cyan neon
      "#FFFFFF"
    ],
    "fill-opacity": 0.15
  }
}

// Layer: historical-zones-outline
{
  id: "historical-zones-outline",
  type: "line",
  source: "historical-zones",
  paint: {
    "line-color": "#FFFFFF",
    "line-width": 2,
    "line-opacity": 0.5,
    "line-dasharray": [2, 2] // Ligne pointillée
  }
}

// Layer: historical-notes-circle
{
  id: "historical-notes-circle",
  type: "circle",
  source: "historical-notes",
  paint: {
    "circle-radius": 6,
    "circle-color": "#FFD700", // Or
    "circle-stroke-width": 2,
    "circle-stroke-color": "#FFFFFF",
    "circle-opacity": 0.8
  }
}
```

**Filtre par année** (slider) :
```typescript
useEffect(() => {
  if (!mapInstance || !timeRiftActive || mode !== 'archives') return;
  
  // Filtre zones par année
  mapInstance.setFilter("historical-zones-fill", [
    "all",
    ["<=", ["get", "yearStart"], selectedYear],
    ["any",
      [">=", ["coalesce", ["get", "yearEnd"], 9999], selectedYear],
      ["!", ["has", "yearEnd"]]
    ]
  ]);
  
  // Filtre notes par année
  mapInstance.setFilter("historical-notes-circle", [
    "<=", ["get", "year"], selectedYear
  ]);
}, [mapInstance, timeRiftActive, mode, selectedYear]);
```

**Click interaction** : Popup avec infos zone/note

---

### Mode 2: 🔥 DECAY HEAT (Activity Heatmap)
**Concept** : Heatmap d'activité "decay score" (pré-calculée serveur)

**Firestore Schema** :
```typescript
// Collection: decay_heatmap (générée côté serveur, mise à jour mensuelle)
interface DecayHeatCell {
  id: string; // "h3_index_8a1234567890" (H3 geospatial index)
  lat: number;
  lng: number;
  score: number; // 0-100 (density de spots + ancienneté + reports)
  year: number; // Année de calcul
  updatedAt: Timestamp;
}
```

**Génération serveur** (Cloud Function mensuelle) :
```typescript
// Calcul decay score par cellule H3 (niveau 8 = ~0.46 km²)
score = (
  spotDensity * 0.4 +        // Nombre de spots dans cellule
  avgAgeYears * 0.3 +         // Ancienneté moyenne des spots
  userActivityCount * 0.2 +   // Visites/comments/likes
  decayReports * 0.1          // User-submitted "decay level"
);
```

**Mapbox Layer** :
```typescript
// Layer: decay-heatmap (heatmap native Mapbox)
{
  id: "decay-heatmap",
  type: "heatmap",
  source: "decay-heatmap",
  paint: {
    "heatmap-weight": ["get", "score"],
    "heatmap-intensity": 1.2,
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(0, 0, 0, 0)",
      0.2, "rgba(74, 244, 255, 0.3)",   // Cyan froid
      0.5, "rgba(163, 86, 255, 0.5)",   // Violet mid
      0.8, "rgba(255, 74, 138, 0.7)",   // Rose chaud
      1, "rgba(255, 0, 0, 0.9)"         // Rouge max decay
    ],
    "heatmap-radius": 30,
    "heatmap-opacity": 0.7
  }
}
```

**Filtre par année** :
```typescript
mapInstance.setFilter("decay-heatmap", ["==", ["get", "year"], selectedYear]);
```

**Note** : Heatmap pré-calculée = **zéro lag** (pas de calcul client)

---

### Mode 3: ⏳ THEN/NOW (Style Toggle)
**Concept** : Bascule entre 2 styles de carte + label animé

**Styles** :
- **THEN** : Style "satellite" ou "outdoors" (vue naturelle/ancienne)
- **NOW** : Style "dark" actuel (UrbexQueens theme)

**Toggle Logic** :
```typescript
const [thenNowMode, setThenNowMode] = useState<"then" | "now">("now");

useEffect(() => {
  if (!mapInstance || mode !== "then-now") return;
  
  const targetStyle = thenNowMode === "then" 
    ? "mapbox://styles/mapbox/satellite-streets-v12"
    : "mapbox://styles/mapbox/dark-v11";
  
  mapInstance.setStyle(targetStyle);
}, [mapInstance, mode, thenNowMode]);
```

**Label animé** (overlay en haut à gauche) :
```tsx
{mode === "then-now" && (
  <div className="then-now-label">
    <button 
      className={thenNowMode === "then" ? "active" : ""}
      onClick={() => setThenNowMode("then")}
    >
      THEN
    </button>
    <span className="then-now-divider">/</span>
    <button 
      className={thenNowMode === "now" ? "active" : ""}
      onClick={() => setThenNowMode("now")}
    >
      NOW
    </button>
  </div>
)}
```

**CSS Animation** (glitch transition) :
```css
.then-now-label button.active {
  color: #4AF4FF;
  text-shadow: 0 0 10px rgba(74, 244, 255, 0.8);
  animation: glitch 0.3s ease;
}

@keyframes glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(2px, -2px); }
  60% { transform: translate(-2px, -2px); }
  80% { transform: translate(2px, 2px); }
  100% { transform: translate(0); }
}
```

---

## 🛡️ PRO GATING

### Non-PRO Click → Paywall
```typescript
const handleHistoryClick = () => {
  if (!isPro) {
    navigate("/pro?src=history");
    return;
  }
  
  setTimeRiftActive(true);
};
```

### Pitch Page `/pro?src=history`
**Hero Section** :
```tsx
<div className="pro-pitch-history">
  <h1>🕰️ Débloque Time Rift</h1>
  <p className="pitch">
    Voyage dans le temps pour voir la carte comme une <strong>archive vivante</strong>.
  </p>
  
  <ul className="features">
    <li>📜 <strong>Archives</strong> : Zones historiques curées + notes d'époque</li>
    <li>🔥 <strong>Decay Heat</strong> : Heatmap d'activité et d'abandon</li>
    <li>⏳ <strong>Then/Now</strong> : Compare la carte d'hier à aujourd'hui</li>
  </ul>
  
  <button className="cta-upgrade">
    Passer PRO — 4.99$/mois
  </button>
</div>
```

---

## 📦 IMPLEMENTATION ROADMAP

### Phase 1: UI/UX (2-3h)
1. ✅ Ajouter bouton HISTORY dans `MapProPanel.tsx`
2. ✅ Créer composant `TimeRiftPanel.tsx` (panel + slider + modes)
3. ✅ Ajouter CSS overlay effects (grain + scanlines + teinte)
4. ✅ PRO gating logic + redirect paywall

### Phase 2: Mode Archives (3-4h)
1. ✅ Firestore collections (`historical_zones`, `historical_notes`)
2. ✅ Mapbox layers (zones fill/outline, notes circle)
3. ✅ Filtre année (slider → update filters)
4. ✅ Click interaction (popup avec infos)
5. ✅ Admin UI pour curation (ajouter zones/notes)

### Phase 3: Mode Decay Heat (4-5h)
1. ✅ Firestore collection `decay_heatmap` (H3 cells)
2. ✅ Cloud Function mensuelle (calcul scores)
3. ✅ Mapbox heatmap layer (gradient cyan→rouge)
4. ✅ Filtre année (query Firestore par year)

### Phase 4: Mode Then/Now (1-2h)
1. ✅ Toggle logic (setStyle satellite vs dark)
2. ✅ Label animé (THEN / NOW avec glitch)
3. ✅ Smooth transition (Mapbox style change)

### Phase 5: Polish & QA (2-3h)
1. ✅ Performance audit (lazy load historical data)
2. ✅ Mobile responsive (slider + panel)
3. ✅ DEV logs cleanup
4. ✅ E2E tests (Playwright: PRO gating, mode toggle, slider)

**Total Estimate** : **12-17 heures**

---

## 🎨 CSS STYLES (Time Rift Panel)

```css
/* Time Rift Panel - Floating bottom overlay */
.time-rift-panel {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 700px;
  
  background: rgba(11, 10, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 16px 20px;
  
  box-shadow:
    0 16px 38px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 0 30px rgba(163, 86, 255, 0.2);
  
  backdrop-filter: blur(20px);
  z-index: 10000;
  
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header */
.time-rift-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-rift-title {
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 0 10px rgba(74, 244, 255, 0.5);
}

.time-rift-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 0.2s;
}

.time-rift-close:hover {
  color: rgba(255, 74, 138, 0.9);
}

/* Modes (3 buttons) */
.time-rift-modes {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.time-rift-mode {
  flex: 1;
  padding: 8px 12px;
  
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  
  cursor: pointer;
  transition: all 0.2s;
}

.time-rift-mode:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(163, 86, 255, 0.4);
  color: rgba(255, 255, 255, 0.9);
}

.time-rift-mode.active {
  background: linear-gradient(180deg, rgba(163, 86, 255, 0.3), rgba(74, 244, 255, 0.2));
  border-color: rgba(74, 244, 255, 0.6);
  color: rgba(255, 255, 255, 1);
  box-shadow: 0 0 12px rgba(74, 244, 255, 0.3);
}

/* Slider */
.time-rift-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-rift-slider label {
  font-size: 1.2rem;
}

.time-rift-slider input[type="range"] {
  flex: 1;
  height: 6px;
  
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;
  
  appearance: none;
  -webkit-appearance: none;
}

.time-rift-slider input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  
  width: 16px;
  height: 16px;
  
  background: linear-gradient(180deg, #4AF4FF, #A356FF);
  border: 2px solid #FFFFFF;
  border-radius: 50%;
  
  cursor: pointer;
  box-shadow: 0 0 10px rgba(74, 244, 255, 0.5);
  
  transition: transform 0.2s;
}

.time-rift-slider input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.time-rift-year {
  font-size: 0.9rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  min-width: 50px;
  text-align: right;
}

/* Map overlay effects (when Time Rift active) */
.map-container.time-rift-active::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  
  /* Grain texture */
  background-image: 
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.03),
      rgba(0, 0, 0, 0.03) 1px,
      transparent 1px,
      transparent 2px
    );
  
  /* Teinte overlay (change selon mode) */
  background-color: rgba(255, 230, 180, 0.06); /* Default: sépia */
  
  /* Vignette */
  box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.4);
  
  mix-blend-mode: multiply;
}

/* Then/Now label (overlay top-left) */
.then-now-label {
  position: absolute;
  top: 80px;
  left: 12px;
  
  display: flex;
  align-items: center;
  gap: 8px;
  
  background: rgba(11, 10, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 8px 16px;
  
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
  z-index: 10001;
}

.then-now-label button {
  background: none;
  border: none;
  
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s;
}

.then-now-label button.active {
  color: #4AF4FF;
  text-shadow: 0 0 10px rgba(74, 244, 255, 0.8);
}

.then-now-divider {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 300;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .time-rift-panel {
    width: 90%;
    padding: 12px 16px;
  }
  
  .time-rift-modes {
    flex-direction: column;
  }
  
  .time-rift-mode {
    font-size: 0.7rem;
  }
  
  .time-rift-slider {
    flex-wrap: wrap;
  }
}
```

---

## 🎯 NEXT STEPS

1. **Valider concept** avec toi (design + modes + gating)
2. **Prioriser phases** (Archives → Decay → Then/Now ou autre ordre ?)
3. **Créer Firestore schemas** (historical_zones, historical_notes, decay_heatmap)
4. **Implémenter UI** (HISTORY button + TimeRiftPanel + overlay effects)
5. **Curation admin UI** (ajouter zones/notes historiques)

---

**Feedback** ? Des ajustements au concept ? Quelle phase tu veux attaquer en premier ? 🚀
