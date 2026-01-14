# 🔍 ROUTE PLANNER - Diagnostic Instrumentation

## ✅ Instrumentation ajoutée (DEV uniquement)

### **🆕 LAYER 0 : UI Button direct** (MapProPanel.tsx)
```typescript
[ROUTE][UI_BUTTON_CLICK] { target: "BUTTON", current: "BUTTON", defaultPrevented: false }
[ROUTE][UI_TOP_ELEMENT] <button class="map-pro-pill..."> "map-pro-pill..."
```
- **Apparaît** : Dès que le click DOM atteint le bouton `<button>` React
- **N'apparaît PAS** : Overlay au-dessus capture le click **avant** React
- **Top element check** : Si `elementFromPoint()` retourne autre chose que le bouton → overlay confirmé

### 1️⃣ **Handler entry point** (MapRoute.tsx)
```typescript
[ROUTE][TOGGLE_CLICK] { state: true/false, ref: true/false }
```
- **Apparaît** : Dès que le click atteint `handleRouteToggle`
- **N'apparaît PAS** : `onRouteToggle` prop pas relié ou shadowing

### 2️⃣ **State change tracer**
```typescript
[ROUTE][STATE_CHANGE] true/false
```
- **Trace** : TOUS les flips de `routePlannerActive` (détecte setters concurrents)
- **Pattern attendu** : 
  - `true` après click ON
  - `false` après click OFF
  - **JAMAIS** : `false` puis immédiatement `true` (= setter concurrent)

### 3️⃣ **Hard OFF completion**
```typescript
[ROUTE][HARD_OFF_DONE]
```
- **Apparaît** : Après cleanup complet (state + ref + Mapbox layers)
- **Confirme** : La branche OFF a bien été exécutée

---

## 🧪 Test QA avec logs (MISE À JOUR)

### **Procédure** :
1. Ouvrir DevTools Console (filter: `ROUTE`)
2. PRO account, cliquer **ROUTE** button (1ère fois)
3. Cliquer 2 pins (route visible)
4. Cliquer **ROUTE** button (2e fois, pour désactiver)

### **Logs attendus (séquence normale complète)** :

#### **Étape 2 : Activation**
```
[ROUTE][UI_BUTTON_CLICK] { target: "BUTTON", current: "BUTTON", ... }
[ROUTE][UI_TOP_ELEMENT] <button class="map-pro-pill..."> "map-pro-pill..."
[ROUTE][TOGGLE_CLICK] { state: false, ref: false }
[ROUTE] Toggle ON
[ROUTE][STATE_CHANGE] true
📍 ROUTE planner activé - Sélectionnez des spots pour créer un itinéraire
```

#### **Étape 4 : Désactivation HARD OFF**
```
[ROUTE][UI_BUTTON_CLICK] { target: "BUTTON", current: "BUTTON", ... }
[ROUTE][UI_TOP_ELEMENT] <button class="map-pro-pill..."> "map-pro-pill..."
[ROUTE][TOGGLE_CLICK] { state: true, ref: true }
[ROUTE] HARD OFF: cleared state + forced layers hidden
[ROUTE][HARD_OFF_DONE]
[ROUTE][STATE_CHANGE] false
📍 ROUTE planner désactivé
```

---

## 🐛 Diagnostic par pattern de logs (MISE À JOUR)

### **CAS A.1 : Click n'atteint même pas le bouton UI**

**Symptôme** :
```
(aucun log [ROUTE][UI_BUTTON_CLICK])
```

**Cause probable** :
- Overlay transparent **au-dessus** du bouton (z-index plus élevé)
- Parent avec `pointer-events: none` (empêche propagation)
- Map canvas déborde sur la zone du bouton

**Fix** :
1. Vérifier `[ROUTE][UI_TOP_ELEMENT]` → si autre chose qu'un `<button>` → overlay confirmé
2. Inspecter DOM : élément au-dessus ? Check z-index
3. Test rapide : ajouter `z-index: 99999 !important;` sur `.map-pro-pill`
4. Si map canvas : ajouter `pointer-events: none;` sur `.mapboxgl-canvas-container` (sauf zones interactives)

---

### **CAS A.2 : Button click OK, mais handler pas appelé**

**Symptôme** :
```
[ROUTE][UI_BUTTON_CLICK] ✅
[ROUTE][UI_TOP_ELEMENT] <button> ✅
(mais aucun [ROUTE][TOGGLE_CLICK])
```

**Cause probable** :
- `onRouteToggle` prop **undefined** ou **pas relié** au bon handler
- Shadowing de variable (`onRouteToggle` local vs prop)
- MapProPanel pas re-render avec nouvelle prop

**Fix** :
1. Vérifier MapRoute.tsx ligne ~2565 : `onRouteToggle={handleRouteToggle}` présent ?
2. Ajouter log dans MapProPanel :
   ```typescript
   if (import.meta.env.DEV) {
     console.log("[ROUTE][UI_PROP_CHECK]", typeof onRouteToggle);
   }
   ```
3. Si `undefined` → prop pas passé, vérifier parent

---

### **CAS B : Handler run, mais état revient à ON**

**Symptôme** :
```
[ROUTE][UI_BUTTON_CLICK] ✅
[ROUTE][TOGGLE_CLICK] { state: true, ref: true } ✅
[ROUTE][HARD_OFF_DONE] ✅
[ROUTE][STATE_CHANGE] false ✅
[ROUTE][STATE_CHANGE] true ⚠️ ← Flip immédiat !
```

**Cause probable** :
- Setter concurrent (restore, useEffect, style.load event)
- React.memo sur MapProPanel avec props comparison bug
- Double attach de listeners

**Fix** :
1. Ajouter **stack trace** au log `[ROUTE][STATE_CHANGE]` :
   ```typescript
   console.log("[ROUTE][STATE_CHANGE]", routePlannerActive, new Error().stack);
   ```
2. Identifier l'appel concurrent dans la stack
3. Neutraliser le setter concurrent

---

### **CAS C : Handler run correctement, layers restent visibles**

**Symptôme** :
```
[ROUTE][UI_BUTTON_CLICK] ✅
[ROUTE][TOGGLE_CLICK] { state: true, ref: true } ✅
[ROUTE][HARD_OFF_DONE] ✅
[ROUTE][STATE_CHANGE] false ✅
(mais la route line reste visible sur la map)
```

**Cause probable** :
- `mapInstance` est `null` au moment du toggle OFF
- Layers IDs (`route-line-layer`, `route-waypoints-layer`) incorrects
- Source IDs (`route-line`, `route-waypoints`) incorrects

**Fix** :
1. Ajouter log dans HARD OFF :
   ```typescript
   console.log("[ROUTE][HARD_OFF_MAPBOX]", {
     hasMapInstance: !!mapInstance,
     routeLayer: !!mapInstance?.getLayer("route-line-layer"),
     waypointsLayer: !!mapInstance?.getLayer("route-waypoints-layer"),
   });
   ```
2. Si `hasMapInstance: false` → attendre map init avant HARD OFF
3. Si layers `false` → vérifier IDs (typo dans layer creation)

---

## 📊 Analyse des setters (grep results)

### **Tous les `setRoutePlannerActive` dans MapRoute.tsx** :
1. **Ligne 231** : `useState(false)` → init
2. **Ligne 2455** : `setRoutePlannerActive(true)` → handler ON
3. **Ligne 2461** : `setRoutePlannerActive(false)` → handler OFF

**✅ Aucun setter concurrent** (pas de restore, pas de localStorage, pas d'auto-reactivation).

---

## 🎯 Diagnostic arbre de décision (MISE À JOUR)

```
Click ROUTE button (2e fois, pour OFF)
│
├─ [ROUTE][UI_BUTTON_CLICK] apparaît ?
│  │
│  NO ─── CAS A.1 : Overlay au-dessus du bouton
│  │      Check [UI_TOP_ELEMENT] → fix z-index / pointer-events
│  │
│  YES ─── Button reçoit le click ✅
│          │
│          ├─ [ROUTE][TOGGLE_CLICK] apparaît ?
│          │  │
│          │  NO ─── CAS A.2 : onRouteToggle pas relié
│          │  │      Check prop MapRoute → MapProPanel
│          │  │
│          │  YES ─── Handler appelé ✅
│          │          │
│          │          ├─ [ROUTE][STATE_CHANGE] false puis true ?
│          │          │  │
│          │          │  YES ─── CAS B : Setter concurrent
│          │          │  │       Add stack trace, neutralize setter
│          │          │  │
│          │          │  NO ─── État reste false ✅
│          │          │         │
│          │          │         └─ Layers visibles ?
│          │          │            │
│          │          │            YES ─── CAS C : Mapbox fail
│          │          │            │       Check mapInstance, layer IDs
│          │          │            │
│          │          │            NO ─── ✅ FEATURE OK !
│          │          │                   Ship to prod
```

---

### **CAS B : Handler run, mais état revient à ON**

**Symptôme** :
```
[ROUTE][TOGGLE_CLICK] { state: true, ref: true }
[ROUTE][HARD_OFF_DONE]
[ROUTE][STATE_CHANGE] false
[ROUTE][STATE_CHANGE] true  ← ⚠️ Flip immédiat !
```

**Cause probable** :
- Setter concurrent (restore, useEffect, style.load event)
- React.memo sur MapProPanel avec props comparison bug
- Double attach de listeners

**Fix** :
1. Ajouter **stack trace** au log `[ROUTE][STATE_CHANGE]` :
   ```typescript
   console.log("[ROUTE][STATE_CHANGE]", routePlannerActive, new Error().stack);
   ```
2. Identifier l'appel concurrent dans la stack
3. Neutraliser le setter concurrent

---

### **CAS C : Handler run correctement, layers restent visibles**

**Symptôme** :
```
[ROUTE][TOGGLE_CLICK] { state: true, ref: true }
[ROUTE][HARD_OFF_DONE]
[ROUTE][STATE_CHANGE] false
(mais la route line reste visible sur la map)
```

**Cause probable** :
- `mapInstance` est `null` au moment du toggle OFF
- Layers IDs (`route-line-layer`, `route-waypoints-layer`) incorrects
- Source IDs (`route-line`, `route-waypoints`) incorrects

**Fix** :
1. Ajouter log dans HARD OFF :
   ```typescript
   console.log("[ROUTE][HARD_OFF_MAPBOX]", {
     hasMapInstance: !!mapInstance,
     routeLayer: !!mapInstance?.getLayer("route-line-layer"),
     waypointsLayer: !!mapInstance?.getLayer("route-waypoints-layer"),
   });
   ```
2. Si `hasMapInstance: false` → attendre map init avant HARD OFF
3. Si layers `false` → vérifier IDs (typo dans layer creation)

---

## 📊 Analyse des setters (grep results)

### **Tous les `setRoutePlannerActive` dans MapRoute.tsx** :
1. **Ligne 231** : `useState(false)` → init
2. **Ligne 2455** : `setRoutePlannerActive(true)` → handler ON
3. **Ligne 2461** : `setRoutePlannerActive(false)` → handler OFF

**✅ Aucun setter concurrent** (pas de restore, pas de localStorage, pas d'auto-reactivation).

---

## 🎯 Next steps (selon logs)

### **Si aucun log `[ROUTE][TOGGLE_CLICK]`** :
→ **CAS A** : Problème UI (click bloqué)
→ Inspecter DOM, tester `pointer-events`

### **Si `[ROUTE][HARD_OFF_DONE]` mais état revient `true`** :
→ **CAS B** : Setter concurrent
→ Ajouter stack trace, neutraliser le setter

### **Si logs OK mais layers visibles** :
→ **CAS C** : Mapbox layers pas cleared
→ Vérifier `mapInstance`, layer IDs, source IDs

---

## 🔒 Patch "ultime" si setter concurrent trouvé

**Pattern fail-safe** : Flag `manualRouteOffRef` pour bloquer auto-reactivation

```typescript
// Ligne ~230 (avec les autres refs)
const manualRouteOffRef = useRef(false);

// Dans handleRouteToggle, branche OFF
const hardOff = () => {
  manualRouteOffRef.current = true; // ✅ Priorité absolue
  setRoutePlannerActive(false);
  routePlannerActiveRef.current = false;
  // ... reste du cleanup
};

// Dans tout effect suspect qui pourrait remettre ON
useEffect(() => {
  if (manualRouteOffRef.current) return; // 🔒 Bloque toute réactivation auto
  // logique restore ici
}, [...]);
```

**Objectif** : Si user clique OFF → aucun effect ne peut réactiver le mode (priorité UX absolue).

---

## ✅ Build avec instrumentation
```
✓ built in 12.85s
precache 53 entries (3943.99 KiB)
MapRoute-BnCZatdS.js: 1,966.57 kB │ gzip: 554.77 kB
```

**Status** : Instrumentation active en DEV. Prêt pour test QA manuel avec console monitoring.
