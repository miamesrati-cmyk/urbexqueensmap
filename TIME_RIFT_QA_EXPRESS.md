# 🕰️ TIME RIFT — QA EXPRESS (2 MINUTES)

## ✅ HARD OFF FIX APPLIED

**Changements critiques** :
1. ✅ **hardOffHistory()** — Fonction centralisée pour TOUS les chemins OFF
2. ✅ **3 chemins unifiés** :
   - Re-clic bouton TIME RIFT → toggle OFF → `hardOffHistory()`
   - Clic × dans TimeRiftPanel → `onClose={hardOffHistory}`
   - Perte PRO → useEffect → `hardOffHistory()`

**Garantie** : `setHistoryActive(false)` + hide layers + clear source GeoJSON + remove CSS overlay class.

---

## 🧪 TEST 1: PRO USER (1 min 30s)

### Setup
1. **Login PRO** (ou dev mode avec `isPro=true`)
2. Navigate `/map`
3. Ouvrir DevTools console (logs `[HISTORY][TOGGLE]`)

### Test Sequence

#### A) Toggle ON
- Click **🕰️ TIME RIFT** button
- ✅ **Expected** :
  - Console: `[HISTORY][TOGGLE] prev->next { prev: false, next: true }`
  - TimeRiftPanel apparaît (bottom floating)
  - Default mode: **📜 ARCHIVES** (sépia tint visible sur map)
  - Tagline: "PRO • Accès aux couches d'archives"
  - Year preset: **NOW** (2026) active

#### B) Mode Switch
- Click **🔥 DECAY**
  - ✅ Violet tint overlay
  - ✅ Heatmap circles apparaissent (reuses existing spots low-opacity)
  - Console: `[HISTORY] Mode: decay Year: 2026`

- Click **⏳ THEN/NOW**
  - ✅ Blue tint overlay
  - ✅ Heatmap hidden
  - Console: `[HISTORY] Mode: thenNow Year: 2026`

- Click **📜 ARCHIVES**
  - ✅ Sépia tint retour
  - ✅ Heatmap hidden

#### C) Year Presets
- Click '90, '00, '10, '20, NOW
  - ✅ Year display updates instantanément
  - Console: `[HISTORY] Mode: archives Year: 1990/2000/2010/2020/2026`

#### D) Toggle OFF (button)
- Click **🕰️ TIME RIFT** button again
- ✅ **Expected (HARD OFF)** :
  - Console:
    ```
    [HISTORY][TOGGLE] prev->next { prev: true, next: false }
    [HISTORY][HARD OFF] Cleanup complete
    ```
  - Panel disappears
  - Overlay tint disappears
  - Heatmap hidden (if was on DECAY)
  - Button no longer active (no `.is-active` class)

#### E) Toggle ON → Close × (panel)
- Click TIME RIFT → Panel opens (ARCHIVES mode)
- Click **×** button in panel
- ✅ **Expected (HARD OFF)** :
  - Console:
    ```
    [HISTORY][HARD OFF] Cleanup complete
    ```
  - Panel disappears
  - Overlay tint disappears
  - Button no longer active

#### F) Rapid Toggle (5x fast)
- Click TIME RIFT → ON → OFF → ON → OFF → ON
- ✅ **Expected (BULLET-PROOF)** :
  - Every click toggles correctly (5 console logs)
  - No stuck state (always responsive)
  - No lag spikes
  - Overlay appears/disappears smoothly

---

## 🧪 TEST 2: NON-PRO USER (30 seconds)

### Setup
1. **Logout** (ou incognito mode)
2. Navigate `/map`

### Test Sequence

#### A) Click TIME RIFT (locked)
- Click **🕰️ TIME RIFT** button (avec badge PRO gradient visible)
- ✅ **Expected (GLITCH + REDIRECT)** :
  - Glitch animation (300ms shake + purple/cyan glow)
  - Redirect to `/pro?src=history`
  - Paywall pitch visible ("TIME RIFT : Archive vivante, PRO seulement")

#### B) Back Navigation
- Click browser back button
- ✅ **Expected** :
  - Return to `/map`
  - TIME RIFT still inactive (no panel, no overlay, no tint)
  - Button shows PRO badge (not glitched)

#### C) Console Check
- Open DevTools
- ✅ **Expected** :
  - **No logs** `[HISTORY][TOGGLE]` (non-PRO never calls toggle)
  - **No errors** in console
  - **No state mutation** (historyActive stays false)

---

## 🧪 TEST 3: REGRESSION (ROUTE/CLUSTER)

### Setup
1. **PRO user**, navigate `/map`

### Test Sequence

#### A) ROUTE Toggle (sanity check)
- Toggle **📍 ROUTE** ON → Click 2 pins → Route visible
- Toggle **📍 ROUTE** OFF
- ✅ **Expected** :
  - Console: `[ROUTE][TOGGLE] prev->next { prev: true, next: false }`
  - Route disappears (same HARD OFF pattern)

#### B) TIME RIFT + ROUTE Coexistence
- Toggle **TIME RIFT** ON (DECAY mode)
- Toggle **ROUTE** ON → Click 2 pins
- ✅ **Expected** :
  - Both features active simultaneously
  - Route line visible OVER heatmap circles
  - No z-index conflict
  - No lag spikes

#### C) CLUSTER Toggle
- Toggle **🌐 CLUSTER** ON
- ✅ **Expected** :
  - Spots cluster (replaces markers)
  - TIME RIFT overlay still visible (no CSS conflict)
  - Cluster circles don't interfere with heatmap

---

## 🎯 SUCCESS CRITERIA

### ✅ HARD OFF Guaranteed
- [ ] 3 paths tested (button, ×, non-PRO guard) → ALL clear layers + state
- [ ] Console shows `[HISTORY][HARD OFF]` every time
- [ ] Rapid toggle (5x) → never stuck, always responsive

### ✅ Portail Narratif Ressenti
- [ ] Glitch animation = mystery activation (not frustration)
- [ ] Overlay tints = temporal shift immersion
- [ ] Decay heatmap = zones mortes vibe

### ✅ Zero Data
- [ ] No fetch calls (check Network tab: 0 requests to `/api/archives` or similar)
- [ ] DECAY reuses existing `places` (visible in console logs)
- [ ] ARCHIVES/THEN-NOW CSS only (no Mapbox tile requests)

### ✅ Performance
- [ ] No lag spikes (FPS stable 60fps)
- [ ] Smooth transitions (mode switch <100ms)
- [ ] Mobile Safari OK (no freeze, no crash)

---

## 🚨 KNOWN ISSUES (IF QA FAILS)

### Issue 1: Panel doesn't close on ×
**Symptom** : Click × → nothing happens  
**Fix** : Verify TimeRiftPanel `onClose` wired to `hardOffHistory` (not inline `setHistoryActive(false)`)

### Issue 2: Heatmap persists after OFF
**Symptom** : Toggle OFF → circles still visible  
**Fix** : Check `hardOffHistory()` clears GeoJSON source:
```typescript
const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource | undefined;
if (source) {
  source.setData({ type: "FeatureCollection", features: [] });
}
```

### Issue 3: Rapid toggle causes stuck ON
**Symptom** : Toggle 5x fast → button stays active  
**Fix** : Verify `handleHistoryToggle` uses functional setState `(prev) => !prev` (not direct read)

### Issue 4: Glitch animation doesn't fire (non-PRO)
**Symptom** : Non-PRO click → no shake/glow  
**Fix** : Check CSS `.is-locked-pulse` applied in MapProPanel click handler (setTimeout 300ms)

### Issue 5: Overlay blocks buttons
**Symptom** : TIME RIFT active → can't click ROUTE/CLUSTER  
**Fix** : Verify time-rift.css overlay has `pointer-events: none` (line 40)

---

## 📊 QUICK METRICS

| Test | Duration | Expected Result |
|------|----------|----------------|
| PRO Toggle ON/OFF | 15s | Panel + overlay + logs |
| PRO Mode Switch | 20s | Tints change instantly |
| PRO Rapid Toggle 5x | 10s | Never stuck |
| PRO Close × | 5s | HARD OFF cleanup |
| Non-PRO Glitch | 10s | 300ms anim + redirect |
| Regression ROUTE | 15s | No conflict |
| Performance Check | 15s | 60fps smooth |
| **TOTAL** | **90s** | **All ✅** |

---

## 🎬 SHIP CRITERIA

✅ **All 3 tests pass** (PRO, non-PRO, regression)  
✅ **No console errors**  
✅ **HARD OFF logs visible** (`[HISTORY][HARD OFF] Cleanup complete`)  
✅ **Glitch animation feels premium** (not frustrating)  
✅ **Build successful** (1970 kB MapRoute, no warnings)

**If all ✅** : TIME RIFT MVP ready to ship 🚀

---

**Test URL** : http://localhost:5174/map  
**Console filter** : `HISTORY|ROUTE` (to isolate relevant logs)  
**HMR status** : Dev server running (auto-reload on file save)

**Next** : Ship → monitor conversion `/pro?src=history` vs `/pro?src=route` (hypothesis: +5-10% uplift)
