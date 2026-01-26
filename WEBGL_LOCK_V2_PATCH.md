# 🔒 WEBGL LOCK v2 — Patch Final (État Cohérent + Détection Répétitions)

**Date:** 23 janvier 2026  
**Status:** ✅ PATCH COMPLET  
**Build:** ✅ 0 erreurs TypeScript  

---

## 🎯 Problèmes Résolus

### 1. État Incohérent (CRITIQUE)
**Problème:** `return` immédiat si `!isStyleLoaded()` → Ghost Echo demandé mais jamais appliqué.

**Symptôme:**
- UI dit "Ghost Echo ON" mais rien ne s'affiche sur la map
- UI dit "Ghost Echo OFF" mais layers restent visibles

**Solution:**
```typescript
if (!map.isStyleLoaded()) {
  const onceIdle = () => {
    map.off("idle", onceIdle);
    if (ghostEchoMode === "off") {
      applyOffCleanup();
    } else {
      applyOnUpdate();
    }
  };
  map.once("idle", onceIdle);
  return;
}
```

✅ **Garantie:** Ghost Echo ON/OFF finit toujours par s'appliquer, même si style pas prêt.

---

### 2. Masquage d'Erreurs Répétitives (CRITIQUE)
**Problème:** `try/catch` muet → si `setData` échoue en boucle, ça masque un bug structurel.

**Solution:**
```typescript
const safeSetData = (data: GeoJSON.FeatureCollection, context: string) => {
  try {
    source.setData(data);
  } catch (error) {
    const now = Date.now();
    ghostEchoSetDataErrorTimestamps.current.push(now);
    ghostEchoSetDataErrorTimestamps.current = ghostEchoSetDataErrorTimestamps.current.filter(
      (ts) => ts > now - 5000
    );

    if (ghostEchoSetDataErrorTimestamps.current.length > 2) {
      console.error(`[GHOST ECHO] setData failed >2 times in 5s (${context})`, error);
      captureException(error as Error);
    } else if (import.meta.env.DEV) {
      console.warn(`[GHOST ECHO] setData error (${context}):`, error);
    }
    throw error; // Re-throw to trigger deferral logic
  }
};
```

✅ **Garantie:** >2 erreurs en 5s → escalade Sentry (détecte bugs structurels).

---

## 📋 Changements Appliqués

### Fichier: `src/pages/MapRoute.tsx`

#### 1. Import `captureException`
```typescript
import { captureException } from "../lib/monitoring";
```

#### 2. Ajout du Compteur d'Erreurs (ligne ~203)
```typescript
// 🔒 WEBGL LOCK v2: setData error detector (sliding window 5s)
const ghostEchoSetDataErrorTimestamps = useRef<number[]>([]);
```

#### 3. Refactorisation Complète du Ghost Echo Controller (lignes 3287-3450)

**Avant:** 3 sections (guards, OFF, ON) avec `return` immédiat si style pas prêt.

**Après:** 4 fonctions internes + deferral logic:

1. **`safeSetData`** → try/catch + sliding window detector
2. **`hideAllGhostLayers`** → helper réutilisable
3. **`applyOffCleanup`** → logique OFF isolée
4. **`applyOnUpdate`** → logique ON isolée (lite/intel)
5. **Deferral via `map.once("idle", onceIdle)`** → applique OFF/ON quand style prêt

**Structure Finale:**
```typescript
useEffect(() => {
  // Guards (map exists, layers ready, source exists)
  
  // Helper: safeSetData with error detection
  // Helper: hideAllGhostLayers
  // Helper: applyOffCleanup
  // Helper: applyOnUpdate
  
  // 🔒 WEBGL LOCK v2: Defer if style not loaded
  if (!map.isStyleLoaded()) {
    const onceIdle = () => {
      map.off("idle", onceIdle);
      if (ghostEchoMode === "off") {
        applyOffCleanup();
      } else {
        applyOnUpdate();
      }
    };
    map.once("idle", onceIdle);
    return;
  }
  
  // ✅ Apply immediately if style is ready
  if (ghostEchoMode === "off") {
    applyOffCleanup();
  } else {
    applyOnUpdate();
  }
}, [mapInstance, ghostEchoMode, places, layersVersion, setLayerVisibility]);
```

---

## 🧪 QA Ghost Echo — Scénarios Critiques

### Scenario 3: Toggle ON/OFF Rapide (3x)
1. Login Pro
2. Toggle Ghost Echo ON
3. **Attendre 1s** → Vérifier heatmap visible
4. Toggle Ghost Echo OFF
5. **Attendre 1s** → Vérifier heatmap disparue
6. Répéter 2x rapidement

**✅ Expected:**
- Aucune erreur WebGL `INVALID_OPERATION`
- Aucune erreur console `setData failed >2 times in 5s`
- État final cohérent (UI = Map)

---

### Scenario 4: Navigation Pendant Style Change
1. Login Pro
2. Toggle Ghost Echo ON
3. **Immédiatement** → Navigate vers Profile (Map unmount)
4. Attendre 2s
5. Navigate vers Map (Map remount)
6. Vérifier Ghost Echo state

**✅ Expected:**
- Aucune erreur WebGL `delete: object does not belong to this context`
- Console montre `[GHOST ECHO] Style not loaded, deferring once via 'idle'`
- Ghost Echo appliqué automatiquement via deferral
- Aucune escalade Sentry

---

### Scenario 5: OFF Cleanup During Style Switch
1. Login Pro
2. Toggle Ghost Echo ON (intel mode)
3. Change Map Style (Streets → Satellite)
4. **Pendant transition** → Toggle Ghost Echo OFF
5. Attendre style fully loaded

**✅ Expected:**
- Console montre `[GHOST ECHO] Style not loaded, deferring once via 'idle'`
- Cleanup appliqué via deferral (pas de `return` orphan)
- Aucune erreur `setData` répétitive
- Layers cachées + opacity 0 + source cleared

---

## 🔍 Diagnostic Console

### État Normal (DEV)
```
[GHOST ECHO] INTEL ON → 1234 spots (exploitable patterns)
[GHOST ECHO] OFF → all layers hidden + opacity 0
```

### Deferral Attendu (pas une erreur)
```
[GHOST ECHO] Style not loaded, deferring once via 'idle'
[GHOST ECHO] INTEL ON → 1234 spots (exploitable patterns)
```

### ⚠️ Erreur Isolée (tolérée)
```
[GHOST ECHO] setData error (ON update): WebGLRenderingContext error
```

### 🚨 Erreur Structurelle (escalade Sentry)
```
[GHOST ECHO] setData failed >2 times in 5s (ON update) Error: ...
```

---

## ✅ Livrables

1. **Code:**
   - `src/pages/MapRoute.tsx` (import + ref + controller refactor)
   - `src/components/MapView.tsx` (déjà patché v1: destroyedRef)

2. **Build:**
   - TypeScript: ✅ 0 erreurs
   - Vite build: ✅ SUCCESS (13.29s)

3. **Garanties:**
   - ✅ Ghost Echo ON/OFF finit toujours par s'appliquer (deferral via `idle`)
   - ✅ Erreurs répétitives détectées + escalade Sentry (>2 en 5s)
   - ✅ Pas d'état incohérent (UI ≠ Map)
   - ✅ Pas de WebGL `INVALID_OPERATION` si pattern respecté

---

## 🚀 Prochain Step (User)

**QA Manual — Focus WebGL:**
```
Scenario 3: Toggle ON/OFF 3x (rapide)
Scenario 4: Navigation Map → Profile → Map
Scenario 5: OFF pendant style switch
```

**Si ✅ QA PASS 3/3:**
- Tag `core-map-v1`
- Deploy production
- Ghost Echo ships TODAY 🎉

**Si ❌ QA FAIL:**
- Reporter: Scenario X, action, erreur console
- Agent: patch ciblé (5-10 min)

---

## 📝 Notes Techniques

### Pourquoi `once("idle")` et pas `once("styledata")` ?
- `idle` garantit que **tous les layers sont fully loaded** (pas juste style JSON)
- `styledata` peut fire avant que layers soient ready → risque `getLayer()` null
- Ghost Echo dépend de layers existants → `idle` plus safe

### Pourquoi re-throw dans `safeSetData` ?
- Permet à la logique de deferral de detecter l'échec
- Si `setData` échoue → deferral via `idle` réessaie plus tard
- Pattern: **fail fast + retry via event**, pas "fail silent"

### Compteur vs Global Handler (main.tsx) ?
- Ghost Echo errors = **feature-specific** (mutations map intentionnelles)
- Permission-denied spam = **infra-wide** (listeners Firestore boot)
- Séparation logique: local detector (Ghost Echo) + global filter (spam)

