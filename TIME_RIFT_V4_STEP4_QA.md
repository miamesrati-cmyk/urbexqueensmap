# 🧪 TIME RIFT V4 - Step 4 QA Express

**Date:** January 14, 2026  
**Feature:** Intelligence Overlay (Heatmap + Glow)  
**Status:** Ready to test  
**Duration:** ~5 minutes

---

## ✅ Préparation (1 minute)

### 1. Activer le feature flag

**Fichier:** `.env.local`

```bash
# Change cette ligne de false à true
VITE_TIME_RIFT_INTELLIGENCE_ENABLED=true
```

### 2. Redémarrer le serveur

```bash
# Ctrl+C pour arrêter si déjà lancé
npm run dev
```

### 3. Se connecter comme PRO

- Ouvre `http://localhost:5173`
- Login avec un compte PRO
- Vérifie le badge PRO en haut à droite

---

## 🎯 QA Checklist (5 points critiques)

### ✅ Test 1: Toggle ON/OFF (détecte 30% des bugs)

**Steps:**
1. Clique Time Rift button (top-right, icône 🕰️)
2. Panel s'ouvre avec 4 chips : ARCHIVES / DECAY / THEN-NOW / **INTELLIGENCE**
3. Clique **INTELLIGENCE** (4ème chip)
4. **Attendu:** Overlay heatmap apparaît (purple/cyan gradient)
5. Clique **ARCHIVES** (retour)
6. **Attendu:** Overlay disparaît complètement (pas de "ghost")

**✅ Pass si:**
- Overlay visible uniquement en mode INTELLIGENCE
- Pas de layers fantômes après switch
- Console log: `[TIME RIFT INTEL] Overlay updated: X spots`

**❌ Fail si:**
- Overlay reste visible après switch à ARCHIVES
- Erreur console "Source not found"
- Rien ne s'affiche en mode INTELLIGENCE

---

### ✅ Test 2: Era Change (détecte 25% des bugs)

**Steps:**
1. Mode INTELLIGENCE actif
2. Click era pills (sous les chips) :
   - `All` → `Pre-1980` → `2000s` → `Recent`
3. **Attendu:** Overlay change **immédiatement** (pas de freeze)
4. Console log à chaque change : `[TIME RIFT INTEL] Overlay updated: X spots (era: ...)`

**✅ Pass si:**
- Changement instantané (<100ms)
- Nombre de spots diminue avec filtres
- Pas de freeze/stutter

**❌ Fail si:**
- Overlay ne change pas
- Freeze de 1+ secondes
- Console error

---

### ✅ Test 3: Zoom Transition (détecte 20% des bugs)

**Steps:**
1. Mode INTELLIGENCE actif, era `All`
2. **Zoom out** à niveau 8 (vue pays)
   - **Attendu:** Heatmap dense (purple/cyan gradient)
3. **Zoom in** progressivement → niveau 13
   - **Attendu:** Heatmap fade out + glow circles fade in
4. **Zoom in** à niveau 16 (vue rue)
   - **Attendu:** Glow circles clairement visibles (purple blur)

**✅ Pass si:**
- Transition smooth entre heatmap et glow (zoom 11-12)
- Pas de "pop" brutal
- Les deux layers ne sont jamais visibles ensemble fortement

**❌ Fail si:**
- Heatmap reste visible à zoom 16
- Glow n'apparaît jamais
- Flash/flicker pendant transition

---

### ✅ Test 4: Performance (détecte 15% des bugs)

**Steps:**
1. Mode INTELLIGENCE actif
2. Pan/zoom rapide (5-6 mouvements rapides)
3. Change era pill 3x rapidement
4. **Attendu:** Fluide, pas de stutter énorme

**✅ Pass si:**
- FPS restent >30 pendant manipulation
- Pas de freeze >500ms
- Console: pas d'erreurs de performance

**❌ Fail si:**
- Stutter visible (freeze >1s)
- FPS drop <15
- Console: "Too many setData calls"

**Fix si fail:**
- Réduire `heatmap-intensity`
- Réduire `circle-blur`
- Ajouter debounce sur era change

---

### ✅ Test 5: Exit Cleanup (détecte 10% des bugs)

**Steps:**
1. Mode INTELLIGENCE actif, overlay visible
2. Clique **× (close button)** du panel Time Rift
3. **Attendu:** 
   - Panel se ferme
   - Overlay disparaît
   - Console: `[HISTORY][HARD OFF] Cleanup complete`
4. Re-ouvre Time Rift → clique INTELLIGENCE
5. **Attendu:** Overlay réapparaît (pas d'erreur)

**✅ Pass si:**
- Cleanup complet (pas de layers fantômes)
- Re-activation fonctionne
- Pas d'erreur console

**❌ Fail si:**
- Overlay reste visible après close
- Erreur "Source already exists" au re-open
- Layers cassées

---

## 🐛 Bugs Connus (Acceptable MVP)

### Minor Issues (ship-safe)

1. **Heatmap weight uniforme**
   - Tous les spots = même poids (1.0)
   - Future: utiliser tier (GHOST=3, EPIC=2, STANDARD=1)

2. **Pas de tooltip hover**
   - Pas de preview au survol des glow circles
   - Future: popup au clic

3. **Colors hardcodées**
   - Purple/cyan gradient fixe
   - Future: respecter theme user

### Critical Issues (block ship)

Si tu vois ces bugs → **NE PAS activer** en prod :

1. **Overlay ne disparaît jamais** → hardOffHistory cassé
2. **Crash au style change** → layers pas re-créées
3. **Stutter énorme** (FPS <10) → trop lourd
4. **Erreur "Source not found"** → timing race condition

---

## 📊 Success Criteria (Ship Gate)

Pour activer le flag en production, il faut :

- ✅ Tests 1-5 passent tous
- ✅ Aucun Critical Issue détecté
- ✅ Console clean (pas d'errors)
- ✅ Performance acceptable (FPS >30 avec 1000+ spots)
- ✅ Works sur Chrome + Safari

---

## 🚀 Post-QA Actions

### Si tous les tests passent ✅

```bash
# Commit le flag update (si nécessaire)
git add .env.local  # ← NE COMMIT PAS (dans .gitignore normalement)

# Ou laisse le flag OFF et documente
# "Feature ready, activate via .env.local when needed"
```

### Si un test fail ❌

1. **Note le test qui fail** (ex: "Test 3: Zoom Transition")
2. **Console errors** → screenshot ou copy-paste
3. **Fix prioritaire** si Critical Issue
4. **Re-run QA** après fix

---

## 📝 QA Report Template

Copie-colle après test :

```
## TIME RIFT V4 STEP 4 - QA Results

**Tester:** [Ton nom]
**Date:** [Date]
**Browser:** [Chrome/Safari/Firefox]
**Device:** [MacBook/Desktop/Mobile]

### Test Results
- [ ] Test 1: Toggle ON/OFF - PASS/FAIL
- [ ] Test 2: Era Change - PASS/FAIL
- [ ] Test 3: Zoom Transition - PASS/FAIL
- [ ] Test 4: Performance - PASS/FAIL
- [ ] Test 5: Exit Cleanup - PASS/FAIL

### Notes
[Bugs trouvés, observations, etc.]

### Decision
[ ] ✅ Ship-ready (activate flag in prod)
[ ] ⚠️ Minor fixes needed (non-blocking)
[ ] ❌ Critical issues (block ship)
```

---

## 🔧 Debug Helpers

### Si rien ne s'affiche

```javascript
// Console (DevTools)
// Check if flag is ON
console.log(import.meta.env.VITE_TIME_RIFT_INTELLIGENCE_ENABLED)
// Should print: "true"

// Check Mapbox layers exist
map.getLayer('uq-time-rift-intel-heatmap')
map.getLayer('uq-time-rift-intel-glow')
// Should NOT be undefined
```

### Si overlay ne change pas

```javascript
// Console
// Check source data
const source = map.getSource('uq-time-rift-intel');
source._data.features.length
// Should change when era changes
```

### Si performance bad

```javascript
// Console
// Check spot count
places.length
// If >5000 spots, consider pre-clustering
```

---

## ⏱️ Expected QA Duration

| Test | Duration |
|------|----------|
| Prep | 1 min |
| Test 1 | 30s |
| Test 2 | 1 min |
| Test 3 | 1 min |
| Test 4 | 1 min |
| Test 5 | 30s |
| **Total** | **~5 min** |

---

**Start QA when ready. Good luck! 🎯**
