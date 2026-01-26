# 🎭 GHOST ECHO — TIERED SYSTEM (Free-lite / Pro-full)

**Date:** 22 janvier 2026  
**Status:** 🟡 **PENDING — Décision tranchée, implementation requise**  
**Business rationale:** Transformer Ghost Echo en outil (pas juste déco)

---

## 🎯 DÉCISION BUSINESS

### **Free = Ghost Echo Lite (acquisition + mystère)**
- **Quoi:** 1 layer cosmétique (effet visuel)
- **Pourquoi:** Acquisition, FOMO, aperçu de la valeur Pro
- **Value:** Esthétique, mystère
- **Limite:** Pas d'info exploitable, juste "wow effect"

### **Pro = Ghost Echo Full (superpouvoirs)**
- **Quoi:** EPIC + GHOST Intel + Decay + Advanced overlays
- **Pourquoi:** Valeur réelle (patterns, heatmaps, data)
- **Value:** Information exploitable, avantage compétitif
- **ROI:** Transforme Ghost Echo en outil stratégique

---

## 🗺️ ARCHITECTURE

### **1. Overlay Access Mapping**

```typescript
// src/pages/MapRoute.tsx

const OVERLAY_TIERS: Record<string, AccessTier[]> = {
  // Free-accessible overlays (cosmetic only)
  "ghost-echo-lite": ["free", "pro", "admin"],
  
  // Pro-only overlays (intelligence + advanced)
  "ghost-echo-intel": ["pro", "admin"],  // Heatmap patterns
  "epic": ["pro", "admin"],              // Decay visualization
  "advanced": ["pro", "admin"],          // Data-driven overlays
};

function canUseOverlay(overlayName: string, userTier: AccessTier): boolean {
  const allowedTiers = OVERLAY_TIERS[overlayName];
  if (!allowedTiers) return false; // Unknown overlay → deny
  return allowedTiers.includes(userTier);
}
```

---

### **2. Modified `handleGhostToggle`**

**Avant (binary toggle):**
```tsx
const handleGhostToggle = useCallback(() => {
  setGhostFilterActive((prev) => !prev);
}, []);
```

**Après (tiered toggle):**
```tsx
const handleGhostToggle = useCallback(() => {
  const userTier = getUserTier(user, isPro, isAdmin);
  
  if (userTier === "guest") {
    // Guest → paywall (acquisition)
    console.warn("[ACCESS] Ghost Echo blocked for guest");
    onUpgradeRequired?.();
    return;
  }
  
  if (userTier === "free") {
    // Free → Ghost Echo Lite (cosmetic only)
    setGhostFilterActive((prev) => !prev);
    setActiveOverlays(ghostFilterActive ? [] : ["ghost-echo-lite"]);
  } else if (userTier === "pro" || userTier === "admin") {
    // Pro → Ghost Echo Full (all overlays)
    setGhostFilterActive((prev) => !prev);
    setActiveOverlays(
      ghostFilterActive 
        ? [] 
        : ["ghost-echo-lite", "ghost-echo-intel", "epic", "advanced"]
    );
  }
}, [user, isPro, isAdmin, ghostFilterActive, onUpgradeRequired]);
```

---

### **3. UI Differentiation (MapProPanel)**

**Badge différencié Free vs Pro:**

```tsx
// src/components/map/MapProPanel.tsx

{!isProUser && user && (
  <button className="map-pro-pill is-locked" onClick={onGhostToggle}>
    <span className="map-pro-pill__lock-icon">🌟</span>
    👻 GHOST LITE
  </button>
)}

{isProUser && (
  <button className="map-pro-pill" onClick={onGhostToggle}>
    👻 GHOST ECHO PRO
  </button>
)}
```

**Teaser tooltip Free:**
```tsx
<Tooltip content="Version lite : effet visuel seul. PRO débloque heatmaps + intel">
  <button>👻 GHOST LITE</button>
</Tooltip>
```

---

## 🎨 UX FLOW

### **Scenario 1: Guest (non-connecté)**
1. Click Ghost Echo button → Paywall modal
2. CTA: "Connecte-toi pour découvrir Ghost Echo Lite"
3. Conversion: Sign-up → Free tier → Access Ghost Echo Lite

### **Scenario 2: Free user**
1. Click Ghost Echo → Active "Ghost Echo Lite" layer
2. Voit: Effet cosmétique (glow, mystère visuel)
3. Ne voit PAS: Heatmaps, intel, decay patterns
4. Tooltip: "Upgrade PRO pour débloquer intel overlays"
5. Click icon 👑 → Paywall modal

### **Scenario 3: Pro user**
1. Click Ghost Echo → Active ALL overlays (lite + intel + epic + advanced)
2. Voit: Heatmaps, patterns exploitables, decay visualization
3. Access: Full intelligence, strategic advantage

---

## 📊 IMPLÉMENTATION TECHNIQUE

### **Step 1: Define Overlay Types**

```typescript
// src/types/overlays.ts (NEW file)

export type OverlayType = 
  | "ghost-echo-lite"
  | "ghost-echo-intel"
  | "epic"
  | "advanced";

export type OverlayConfig = {
  id: OverlayType;
  label: string;
  requiredTier: AccessTier[];
  layer: MapboxLayer; // Mapbox GL style layer spec
};
```

---

### **Step 2: Overlay Configurations**

```typescript
// src/lib/overlays.ts (NEW file)

import type { OverlayConfig } from "../types/overlays";

export const OVERLAY_CONFIGS: OverlayConfig[] = [
  {
    id: "ghost-echo-lite",
    label: "Ghost Echo Lite",
    requiredTier: ["free", "pro", "admin"],
    layer: {
      id: "ghost-lite-layer",
      type: "circle",
      paint: {
        "circle-color": "#9370DB",
        "circle-opacity": 0.3,
        "circle-radius": 20,
        "circle-blur": 1.5,
      },
    },
  },
  {
    id: "ghost-echo-intel",
    label: "Ghost Echo Intel",
    requiredTier: ["pro", "admin"],
    layer: {
      id: "ghost-intel-heatmap",
      type: "heatmap",
      paint: {
        "heatmap-intensity": 1.5,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.3, "rgba(147,112,219,0.4)",
          0.7, "rgba(255,215,0,0.6)",
          1, "rgba(255,69,0,0.8)",
        ],
      },
    },
  },
  // ... EPIC, Advanced configs
];
```

---

### **Step 3: Apply Overlays to Map**

```typescript
// src/pages/MapRoute.tsx

function applyOverlays(map: mapboxgl.Map, overlays: OverlayType[]) {
  // Remove existing overlays
  OVERLAY_CONFIGS.forEach(config => {
    if (map.getLayer(config.layer.id)) {
      map.removeLayer(config.layer.id);
    }
  });
  
  // Add requested overlays
  overlays.forEach(overlayId => {
    const config = OVERLAY_CONFIGS.find(c => c.id === overlayId);
    if (!config) return;
    
    map.addLayer(config.layer);
  });
}

// Dans handleGhostToggle:
const overlaysToApply = userTier === "free" 
  ? ["ghost-echo-lite"]
  : ["ghost-echo-lite", "ghost-echo-intel", "epic", "advanced"];

applyOverlays(mapRef.current, overlaysToApply);
```

---

## ✅ CHECKLIST IMPLEMENTATION

### **Phase 1: Core logic**
- [ ] Créer `src/types/overlays.ts` avec `OverlayType` + `OverlayConfig`
- [ ] Créer `src/lib/overlays.ts` avec `OVERLAY_CONFIGS` array
- [ ] Ajouter `OVERLAY_TIERS` mapping dans `MapRoute.tsx`
- [ ] Créer `canUseOverlay(overlayName, userTier)` helper
- [ ] Modifier `handleGhostToggle` pour tiered logic

### **Phase 2: Map integration**
- [ ] Créer `applyOverlays(map, overlays[])` function
- [ ] Hook overlays au state `activeOverlays`
- [ ] Test: Free voit 1 layer, Pro voit all layers

### **Phase 3: UI differentiation**
- [ ] Modifier `MapProPanel` Ghost button: badge Free vs Pro
- [ ] Ajouter tooltip teaser pour Free users
- [ ] Guest → paywall guard (similaire Satellite/Clustering)

### **Phase 4: Testing**
- [ ] Test Guest: click → paywall modal
- [ ] Test Free: click → Ghost Lite active (cosmetic seul)
- [ ] Test Pro: click → ALL overlays active (heatmap visible)
- [ ] Test toggle OFF: toutes layers supprimées

---

## 🎯 VALIDATION CRITERIA

**Must-have:**
- ✅ Free voit effet cosmétique (pas d'intel)
- ✅ Pro voit heatmap + intel overlays
- ✅ Guest bloqué avec paywall
- ✅ UI différenciée (badge Lite vs Pro)

**Nice-to-have:**
- 🟡 Animation transition entre Lite → Pro upgrade
- 🟡 Tooltip preview (hover sur Lite → aperçu Pro)
- 🟡 Analytics tracking (`ghost-lite-active`, `ghost-pro-active`)

---

## 📊 IMPACT BUSINESS

**Avant:**
- Ghost Echo = déco floue (pas de valeur claire)
- Ambiguïté: Free ou Pro?

**Après:**
- Free = Aperçu cosmétique (acquisition, FOMO)
- Pro = Outil stratégique (heatmaps, patterns, decay intel)
- Clear value ladder: Lite (mystère) → Pro (superpouvoir)

**Conversion metrics attendues:**
- 🎯 Free → Pro conversion: +15-20% (Ghost Echo teaser)
- 🎯 Ghost Echo usage Pro: 60%+ (value perçue élevée)
- 🎯 Retention Free: +10% (feature engagement)

---

**Prochaine étape:** Implémenter Phase 1 (Core logic) dans MapRoute.tsx.

**ETA:** 1h core logic + 30 min UI + 30 min tests = 2h total.

**Blocker:** Définir specs exactes layers Mapbox (heatmap config, circle styles).
