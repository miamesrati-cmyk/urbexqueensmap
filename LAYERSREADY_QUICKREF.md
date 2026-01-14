# 🎯 layersReadyRef - Référence Rapide

## Problème résolu

❌ **AVANT:** Style change Night → Satellite → pins disparus (refresh nécessaire)  
✅ **APRÈS:** Style change → pins reviennent automatiquement

---

## Architecture (3 effects)

### **EFFECT A: INIT**
```typescript
layersReadyRef.current = false;  // AVANT re-init
initializeSpotSources();         // Crée sources + layers
layersReadyRef.current = true;   // APRÈS init

}, [mapInstance, perfSettings.haloBlur, clusteringEnabled]);
```

### **EFFECT B: DATA**
```typescript
if (!layersReadyRef.current) return;  // ⏸️ Wait
activeSource.setData(features);       // ✅ Safe

}, [mapInstance, spotFeatures, clusteringEnabled]);
```

### **EFFECT C: TOGGLE**
```typescript
if (!layersReadyRef.current) return;  // ⏸️ Wait
setLayoutProperty("visibility", ...); // ✅ Safe

}, [mapInstance, clusteringEnabled]);
```

---

## Flow style.load

```
T0: User clique "Satellite"
    → layersReadyRef = false  ← BLOCK DATA/TOGGLE

T1: addSource + addLayer
    → layersReadyRef = true   ← UNBLOCK DATA/TOGGLE

T2: setData(features) ✅
T3: setLayoutProperty(visibility) ✅

Result: Pins visibles sans refresh ✅
```

---

## Tests (< 10 min)

1. **Clustering OFF:** Night → Satellite → pins visibles ✅
2. **Clustering ON:** Night → Satellite → clusters visibles ✅
3. **Spam:** 5× style changes → pas de crash ✅
4. **Performance:** ?perf=1 → "Layer Recreation: NO" ✅

---

## Console logs

**Normal:**
```
[INIT] 🔄 Style changed, re-initializing layers
[INIT] ✅ Layers ready, visibility set to: PLAIN
[DATA] ✅ Updated uq-spots-plain with 42 features
[TOGGLE] ✅ Visibility set to: PLAIN
```

**Erreur (ne devrait JAMAIS apparaître):**
```
[DATA] ⚠️ Active source 'uq-spots-plain' not found   ❌
[TOGGLE] ⚠️ Layer 'spots-circle' not found           ❌
```

---

## Fichiers modifiés

- `src/pages/MapRoute.tsx` (~150 lignes)
- Build: ✅ PASSED (12.9s)
- Bundle: 1,959 kB (unchanged)

---

## Docs complètes

- `MAPBOX_LAYERSREADY_ARCHITECTURE.md` (architecture complète)
- `TEST_STYLE_CHANGES.md` (guide de test)
- `MAPBOX_IMPLEMENTATION_SUMMARY.md` (résumé détaillé)

---

**Status:** ✅ BUILD PASSED - READY FOR TESTING  
**Date:** 2026-01-06
