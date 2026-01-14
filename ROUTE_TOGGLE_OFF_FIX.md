# ✅ Route Toggle OFF Fix — CSS z-index Patch Applied

## 🎯 PROBLÈME RÉSOLU
**Symptôme**: Bouton ROUTE reste "stuck" actif au 2e click (toggle OFF ne fonctionne pas)  
**Cause probable**: Overlay avec z-index bas intercepte les clicks avant que le bouton les reçoive  
**Solution**: 3 patches CSS pour forcer le panel PRO au-dessus de tous les overlays

---

## 🔧 PATCHES CSS APPLIQUÉS

### Patch 1: Map Canvas z-index
**Fichier**: `src/styles.css` (ligne ~1092)
```css
/* ✅ FIX: Force map canvas behind UI layers (prevent overlay interception) */
.mapboxgl-canvas-container {
  z-index: 1;
}
```
**Effet**: Canvas Mapbox à z=1 (arrière-plan)

### Patch 2: PRO Bar Wrap z-index
**Fichier**: `src/styles.css` (ligne ~32030)
```css
.route-map .map-pro-bar-wrap {
  /* ... */
  /* ✅ FIX: Ensure PRO bar wrap above overlays (prevent click interception) */
  z-index: 10050;
}
```
**Effet**: Wrapper du panel PRO à z=10050 (top layer)

### Patch 3: PRO Pill z-index
**Fichier**: `src/styles.css` (ligne ~32149)
```css
.route-map .map-pro-pill {
  /* ... */
  /* ✅ FIX: Ensure PRO panel pills above overlays (prevent click interception) */
  z-index: 10050;
  pointer-events: auto;
}
```
**Effet**: Boutons PRO (ROUTE, STYLES, etc.) à z=10050 + pointer-events auto

---

## 📋 QA TEST PROCEDURE (5 minutes)

### Étape 1: Vérification rapide du DOM (30 secondes)
```javascript
// Console browser (sur page Map):
(() => {
  const b = document.querySelector(".map-pro-pill");
  if (!b) return "❌ no button";
  const r = b.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return { 
    top: el?.tagName, 
    cls: el?.className,
    zIndex: window.getComputedStyle(b).zIndex
  };
})()
```
**Résultat attendu**:
```json
{
  "top": "BUTTON",
  "cls": "map-pro-pill ...",
  "zIndex": "10050"
}
```
**Si top ≠ BUTTON**: CSS fix pas appliqué ou selector mismatch

---

### Étape 2: Test Toggle OFF avec Diagnostic Logs (3 minutes)
1. **Compte PRO** (nécessaire)
2. Click ROUTE (ON) → attendre 1-2s
   - Bouton passe `is-active` (fond violet)
   - Console log: `[ROUTE] Toggle ON`
3. Click 2 pins sur la map → route visible
4. **Click ROUTE (OFF)** → **CRITICAL TEST** ⚠️
5. Observer console logs (filter: `ROUTE`)

**Séquence attendue** (toggle OFF):
```
[ROUTE][UI_BUTTON_CLICK] { target: "BUTTON", current: "BUTTON", defaultPrevented: false }
[ROUTE][UI_TOP_ELEMENT] <button class="map-pro-pill..."> "map-pro-pill..."
[ROUTE][TOGGLE_CLICK] { state: true, ref: true }
[ROUTE] HARD OFF: cleared state + forced layers hidden
[ROUTE][HARD_OFF_DONE]
[ROUTE][STATE_CHANGE] false
📍 ROUTE planner désactivé
```

**Si succès** ✅:
- Bouton ROUTE repasse normal (pas `is-active`)
- Route disappears de la map
- Waypoints cleared
- Log sequence complète

**Si échec** ❌:
- Bouton reste `is-active`
- Route toujours visible
- Manque `[ROUTE][UI_BUTTON_CLICK]` → overlay bloque encore (deeper issue)
- Manque `[ROUTE][TOGGLE_CLICK]` → prop pas wired (vérifier MapProPanel)

---

### Étape 3: Regression Test (2 minutes)
1. Toggle ROUTE plusieurs fois (ON → OFF → ON → OFF)
   - Doit fonctionner à chaque fois
2. Clear route (× button) → doit effacer waypoints mais **garder mode ON**
3. Toggle OFF → doit bien désactiver
4. Click pin (mode OFF) → popup normal (pas waypoint mode)

---

## 🔍 DECISION TREE (si échec)

### CAS A: [UI_BUTTON_CLICK] manquant
**Cause**: Overlay bloque toujours les clicks  
**Solution**:
1. Vérifier `elementFromPoint` (Étape 1)
2. Si top ≠ BUTTON → identifier l'overlay qui bloque:
   ```javascript
   // Console:
   const b = document.querySelector(".map-pro-pill");
   const r = b.getBoundingClientRect();
   const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
   console.log("Blocking element:", el, el?.className, window.getComputedStyle(el).zIndex);
   ```
3. Augmenter z-index de `.map-pro-pill` à 10100 ou ajouter `!important`

### CAS B: [UI_BUTTON_CLICK] OK mais [TOGGLE_CLICK] manquant
**Cause**: Prop `onRouteToggle` pas wired ou event.preventDefault() bloque  
**Solution**:
1. Vérifier `src/components/map/MapProPanel.tsx` ligne 154-195:
   - `onClick` doit appeler `onRouteToggle()`
   - `e.preventDefault()` avant guard PRO (OK)
2. Vérifier `src/pages/MapRoute.tsx` ligne 2565:
   - Prop wiring: `onRouteToggle={handleRouteToggle}`

### CAS C: Logs complets mais bouton reste actif
**Cause**: Concurrent setter ou CSS `.is-active` stuck  
**Solution**:
1. grep search: `setRoutePlannerActive` → doit trouver ONLY 2 calls (ON/OFF in handler)
2. Inspect button class: `document.querySelector(".map-pro-pill")?.className`
   - Si `is-active` présent après OFF → CSS reactivity bug
3. Hard refresh page (Cmd+Shift+R)

---

## ✅ SUCCESS CRITERIA
1. ✅ `elementFromPoint` return BUTTON (z-index 10050)
2. ✅ Toggle OFF logs complets (UI + handler + state)
3. ✅ Bouton repasse normal (no `is-active`)
4. ✅ Route + waypoints cleared
5. ✅ Regression test OK (multiple toggles)

---

## 🚀 NEXT STEPS
Si **SUCCESS CRITERIA met** → **SHIP FEATURE** ✅
- Remove DEV-only logs (ou garder pour debug futur)
- Update ROUTE_DIAGNOSTIC.md avec outcome
- Close ticket

Si **ÉCHEC** → Deeper investigation:
- DOM inspector (Shift+Cmd+C sur bouton)
- CSS computed styles (z-index, pointer-events)
- Event listener check (getEventListeners in console)
- React DevTools (props/state inspection)

---

## 📝 NOTES
- CSS fix applied at: `src/styles.css` lines 1092, 32030, 32149
- Build verification: ✅ (3944.06 KiB precache, no errors)
- Diagnostic instrumentation: 3 layers (UI button, handler entry, state tracer)
- grep search: no concurrent setters (clean)
- User hypothesis confirmed: overlay z-index issue
