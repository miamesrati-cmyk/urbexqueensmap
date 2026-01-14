# ✅ TIME RIFT MVP — FROZEN & READY

## 🎯 HARD OFF Centralisé + IDs Cohérents

### Problème Initial
- **ROUTE toggle OFF bug** : Stale closure (état lu à la callback definition, pas au click)
- **TIME RIFT risque identique** : Multiples chemins OFF (bouton, ×, non-PRO guard) → potentiel incohérence
- **IDs Mapbox inconsistants** : Docs mentionnaient `time-rift-decay` mais code utilisait `history-decay` → risque layers fantômes

---

## ✅ Fix Appliqué : Single Source of Truth

### 1) hardOffHistory() — Cleanup centralisé

**Tous les chemins OFF passent par cette fonction** :

```typescript
const hardOffHistory = useCallback(() => {
  setHistoryActive(false);

  // Fail-safe Mapbox cleanup (if layers/sources exist)
  if (mapInstance) {
    if (mapInstance.getLayer("history-decay-layer")) {
      mapInstance.setLayoutProperty("history-decay-layer", "visibility", "none");
    }
    const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }

  if (import.meta.env.DEV) {
    console.log("[HISTORY][HARD OFF] Cleanup complete");
  }
}, [mapInstance]);
```

**Garantie** :
- ✅ `setHistoryActive(false)` (state reset)
- ✅ Hide Mapbox layer (`visibility: "none"`)
- ✅ Clear GeoJSON source (`features: []`)
- ✅ Log DEV uniquement (trace cleanup)

---

### 2) Tous les Chemins OFF Unifiés

#### A) Re-clic bouton TIME RIFT
```typescript
const handleHistoryToggle = useCallback(() => {
  if (!isPro) {
    hardOffHistory(); // Non-PRO → force OFF immédiat
    return;
  }

  setHistoryActive((prev) => {
    const next = !prev;

    if (import.meta.env.DEV) {
      console.log("[HISTORY][TOGGLE] prev->next", { prev, next });
    }

    // If toggling OFF, use centralized cleanup
    if (!next) {
      setTimeout(() => hardOffHistory(), 0); // Next tick après state update
    }

    return next;
  });
}, [isPro, hardOffHistory]);
```

#### B) Close panel × button
```typescript
<TimeRiftPanel
  active={historyActive}
  mode={historyMode}
  year={historyYear}
  onModeChange={setHistoryMode}
  onYearChange={setHistoryYear}
  onClose={hardOffHistory} // ✅ Direct call, pas inline setHistoryActive(false)
/>
```

#### C) Perte PRO (guard)
```typescript
useEffect(() => {
  if (!isPro && historyActive) {
    hardOffHistory(); // Force OFF si perte statut PRO
    if (import.meta.env.DEV) console.log("[HISTORY] Forced OFF (non-PRO guard)");
  }
}, [isPro, historyActive, hardOffHistory]);
```

---

### 3) IDs Mapbox Figés (Cohérence)

**Standard unique** :
- Source: `"history-decay"`
- Layer: `"history-decay-layer"`

**Vérification** : Aucun ID fantôme ailleurs (grep full repo)
- ❌ `time-rift-decay` (0 matches)
- ❌ `decay-layer` (0 matches)
- ✅ `history-decay` (uniquement MapRoute.tsx, 14 usages cohérents)

---

### 4) Classe CSS — Dépend UNIQUEMENT de historyActive

**Before** (risque persistance) :
```tsx
<div className={`route-map ${historyActive ? "time-rift-active time-rift-mode--" + historyMode : ""}`}>
```

**After** (template literal propre) :
```tsx
<div className={`route-map ${historyActive ? `time-rift-active time-rift-mode--${historyMode}` : ""}`}>
```

**Garantie** : Si `historyActive === false` → **aucune classe** `time-rift-active` (overlay CSS retiré immédiatement).

---

### 5) Zéro Data Confirmé

**DECAY mode** :
- Réutilise `places` déjà en mémoire (via `listenPlaces` existant)
- Aucun fetch nouveau
- Aucun listener Firestore additionnel

**ARCHIVES / THEN-NOW modes** :
- CSS tints uniquement (overlay `::after`)
- Aucune tile Mapbox additionnelle
- Aucune API backend

**Vérification** : Grep `fetch|listenPlaces|listenUsers|subscribe` dans TIME RIFT context → 0 appels nouveaux.

---

### 6) CSS Overlay — pointer-events: none

**time-rift.css** (line 40) :
```css
.route-map.time-rift-active::after {
  pointer-events: none; /* ✅ No click interception */
  z-index: 1;
  /* ... grain, scanlines, vignette ... */
}
```

**Garantie** : Overlay ne bloque jamais les clics sur MapProPanel/TimeRiftPanel/Map.

---

## 🔒 FROZEN SPECS

### État Figé
- ✅ `hardOffHistory()` single source of truth
- ✅ IDs Mapbox: `history-decay` / `history-decay-layer` (pas d'autres variantes)
- ✅ Classe CSS: `time-rift-active` dépend uniquement de `historyActive`
- ✅ Zéro data backend/Firestore
- ✅ CSS overlay `pointer-events: none`
- ✅ Build successful (TypeScript 0 errors, 13.18s)

### Contraintes Strictes
- ❌ **Pas de backend** (zero API calls)
- ❌ **Pas de Firestore nouveau** (only reuses existing `places`)
- ❌ **Pas de refactor map core** (layers isolated, toggle clean)
- ❌ **Pas de blur >1px** (performance constraint)
- ✅ **PRO only** (guards + force OFF + paywall)

---

## 🧪 QA READY (2 minutes)

### Test 1: PRO User (90 seconds)
1. Toggle TIME RIFT ON → Panel visible, ARCHIVES sépia tint
2. Switch modes (DECAY/THEN-NOW) → Tints change instantly
3. Toggle OFF via button → Console: `[HISTORY][HARD OFF] Cleanup complete`
4. Toggle ON → Close × → Console: `[HISTORY][HARD OFF] Cleanup complete`
5. Rapid toggle 5x → Never stuck, always responsive

**Success Criteria** :
- Console shows `[HISTORY][HARD OFF]` à chaque OFF
- Panel + overlay + heatmap toujours cleared
- No lag spikes

### Test 2: Non-PRO User (30 seconds)
1. Click TIME RIFT → Glitch animation 300ms (shake + glow)
2. Redirect `/pro?src=history` → Paywall pitch visible
3. Browser back → TIME RIFT still inactive (no panel/tint)

**Success Criteria** :
- Glitch feel = mystery activation (not frustration)
- No console logs `[HISTORY][TOGGLE]` (non-PRO never mutates state)

---

## 📦 Build Status

```bash
✓ 1343 modules transformed.
✓ built in 13.18s
```

**TypeScript** : ✅ 0 errors  
**Bundle** : MapRoute ~1970 kB (stable)  
**Files Modified** :
- `src/pages/MapRoute.tsx` (+60 lines, hardOffHistory + unified OFF paths)
- `src/components/map/TimeRiftPanel.tsx` (onClose wiring)
- `src/styles/time-rift.css` (no changes, already pointer-events: none)

---

## 🚀 SHIP CRITERIA

✅ **All checks passed** :
- [x] hardOffHistory() single source of truth
- [x] 3 chemins OFF unifiés (button, ×, non-PRO guard)
- [x] IDs Mapbox cohérents (history-decay / history-decay-layer uniquement)
- [x] Classe CSS dépend uniquement historyActive
- [x] Zéro data nouveau (DECAY reuses places, ARCHIVES/THEN-NOW CSS only)
- [x] CSS overlay pointer-events: none
- [x] Build successful (TypeScript clean)

**Next** : QA express 2 min → **SHIP** 🎬

---

## 📝 Logs Attendus (DEV mode)

### Toggle ON
```
[HISTORY][TOGGLE] prev->next { prev: false, next: true }
[HISTORY] Mode: archives Year: 2026
```

### Toggle OFF (button)
```
[HISTORY][TOGGLE] prev->next { prev: true, next: false }
[HISTORY][HARD OFF] Cleanup complete
```

### Toggle OFF (× close)
```
[HISTORY][HARD OFF] Cleanup complete
```

### Force OFF (non-PRO guard)
```
[HISTORY] Forced OFF (non-PRO guard)
[HISTORY][HARD OFF] Cleanup complete
```

---

**Test URL** : http://localhost:5174/map  
**Console filter** : `HISTORY` (isolate TIME RIFT logs)  
**HMR** : Dev server running (auto-reload)

**MVP FROZEN** — Ready for final QA ✅
