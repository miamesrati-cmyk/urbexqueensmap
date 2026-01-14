# 🧪 Test Rapide: Changements de Style (layersReadyRef)

**Objectif:** Valider que pins/clusters reviennent après changement de style Night ↔ Satellite.

---

## ⚡ Test 1: Style change basique (clustering OFF)

### **Setup:**
1. Ouvrir app en mode dev: `npm run dev`
2. Console ouverte (F12)
3. Clustering OFF (pins visibles)

### **Actions:**
1. Cliquer menu style (coin supérieur droit)
2. Sélectionner "Satellite"
3. Attendre 1 seconde

### **Résultat attendu:**
- ✅ Pins réapparaissent sur Satellite sans refresh
- ✅ Console logs:
  ```
  [INIT] 🔄 Style changed, re-initializing layers
  [INIT] Created cluster source
  [INIT] Created plain source
  [INIT] Created Ghost Echo layers
  [INIT] ✅ Layers ready, visibility set to: PLAIN
  [DATA] ✅ Updated uq-spots-plain with N features
  [TOGGLE] ✅ Visibility set to: PLAIN
  ```
- ❌ AUCUN warning "[DATA] ⚠️ not found"
- ❌ AUCUN warning "[TOGGLE] ⚠️ not found"

### **Temps:** < 2 minutes

---

## ⚡ Test 2: Style change avec clustering ON

### **Setup:**
1. App ouverte
2. Toggle clustering ON (clusters visibles sur Night)

### **Actions:**
1. Changer style → Satellite
2. Attendre 1 seconde

### **Résultat attendu:**
- ✅ Clusters réapparaissent sur Satellite
- ✅ Pins restent cachés (pas de double affichage)
- ✅ Console logs:
  ```
  [INIT] 🔄 Style changed, re-initializing layers
  [INIT] ✅ Layers ready, visibility set to: CLUSTER
  [DATA] ✅ Updated uq-spots-clustered with N features
  [TOGGLE] ✅ Visibility set to: CLUSTER
  ```
- ❌ AUCUN pin visible (seulement clusters)

### **Temps:** < 2 minutes

---

## ⚡ Test 3: Spam style changes (stress test)

### **Setup:**
1. App ouverte
2. Clustering OFF

### **Actions:**
1. Changer style: Night → Satellite → Night → Satellite → Night (5× rapide)
2. Attendre 2 secondes

### **Résultat attendu:**
- ✅ Pins visibles sur le style final
- ✅ AUCUN crash
- ✅ Console: 5× "[INIT] 🔄 Style changed"
- ❌ AUCUN warning/error

### **Temps:** < 1 minute

---

## ⚡ Test 4: Style change pendant toggle clustering

### **Setup:**
1. App ouverte
2. Clustering OFF (pins visibles sur Night)

### **Actions:**
1. Toggle clustering ON (clusters visibles)
2. **IMMÉDIATEMENT** changer style → Satellite
3. Attendre 1 seconde

### **Résultat attendu:**
- ✅ Clusters visibles sur Satellite
- ✅ Console: "[INIT] ✅ Layers ready, visibility set to: CLUSTER"
- ❌ AUCUN pin visible

### **Temps:** < 2 minutes

---

## 📊 Test avec Performance HUD (?perf=1)

### **Setup:**
1. Ouvrir `http://localhost:5173/?perf=1`
2. HUD visible en haut à gauche
3. Clustering OFF

### **Actions:**
1. Changer style Night → Satellite
2. Observer HUD pendant 5 secondes

### **Résultat attendu:**
- ✅ "Layer Recreation: NO" (reste stable)
- ✅ "FPS: 55-60" (pas de drop prolongé)
- ✅ "Update Time: < 20ms"
- ✅ Pins visibles après ~50-100ms

### **Temps:** < 2 minutes

---

## 🎯 Checklist récapitulatif

| Test | Clustering | Style change | Pins visibles? | Clusters visibles? | Warnings? | Pass? |
|------|-----------|--------------|----------------|-------------------|-----------|-------|
| 1    | OFF       | Night → Sat  | ✅ OUI         | ❌ NON            | ❌ AUCUN  | ⬜    |
| 2    | ON        | Night → Sat  | ❌ NON         | ✅ OUI            | ❌ AUCUN  | ⬜    |
| 3    | OFF       | 5× spam      | ✅ OUI (final) | ❌ NON            | ❌ AUCUN  | ⬜    |
| 4    | Toggle+   | Night → Sat  | ❌ NON         | ✅ OUI            | ❌ AUCUN  | ⬜    |
| 5    | OFF       | Night → Sat  | ✅ OUI         | ❌ NON            | "Layer Recreation: NO" | ⬜ |

**Status global:** ⬜ EN ATTENTE

---

## 🐛 Si échec, vérifier:

### **Pins ne réapparaissent pas après style change:**

1. Console: chercher "[INIT] 🔄 Style changed"
   - ❌ Absent → `handleStyleLoad` pas appelé (bug listener)
   - ✅ Présent → continuer

2. Console: chercher "[INIT] ✅ Layers ready"
   - ❌ Absent → `initializeSpotSources()` failed (check isStyleLoaded())
   - ✅ Présent → continuer

3. Console: chercher "[DATA] ✅ Updated"
   - ❌ Absent → EFFECT B pas déclenché (check deps)
   - ❌ "[DATA] Layers not ready yet" → `layersReadyRef` pas set (bug INIT)
   - ✅ Présent → continuer

4. Inspecter layers dans console Mapbox:
   ```javascript
   map.getStyle().layers.filter(l => l.id.includes('spot'))
   ```
   - ❌ Empty → layers pas créés
   - ✅ 4 layers présents → continuer

5. Vérifier visibility:
   ```javascript
   map.getLayoutProperty('spots-circle', 'visibility')
   // Attendu: "visible" si clustering OFF
   ```

---

### **Warnings "[DATA] ⚠️ not found":**

**Cause:** setData() appelé avant que source existe

**Fix:** Vérifier que `layersReadyRef.current = true` dans INIT effect APRÈS `addSource()`

---

### **Warnings "[TOGGLE] ⚠️ not found":**

**Cause:** setLayoutProperty() appelé avant que layer existe

**Fix:** Vérifier que `layersReadyRef.current = true` dans INIT effect APRÈS `addLayer()`

---

## ✅ Si tous les tests passent:

**Architecture validée! 🎉**

1. Commit changes:
   ```bash
   git add src/pages/MapRoute.tsx
   git commit -m "feat: layersReadyRef architecture for robust style changes"
   ```

2. Deploy to staging/prod

3. Monitor console logs pendant 24h pour warnings

---

**Temps total:** < 10 minutes  
**Criticité:** 🔴 HIGH (fonctionnalité core)
