# 🧹 Console Cleanup — ZERO BRUIT

**Date:** 2026-01-22  
**Branch:** `fix/time-rift-controller`  
**Objectif:** Éliminer 100% des warnings non-critiques (investisseur-grade console)

---

## 🎯 PROBLÈMES IDENTIFIÉS

### 1️⃣ Warnings [INIT] Retry aborted (superseded)
**Source:** `MapRoute.tsx` (3 occurrences)
- Line ~2134: Retry from style.load
- Line ~2154: Icons loading race check  
- Line ~2497: Final commit race check

**Cause:** React StrictMode + HMR déclenchent plusieurs runs d'initialisation concurrents. Les runs anciens sont "superseded" par les nouveaux → comportement **normal**, pas une erreur.

**Impact:** Pollution console avec `⚠️ Run #X aborted (superseded by #Y)`

---

### 2️⃣ Warnings [ICONS] not in sprite, using fallback
**Source:** `mapboxIcons.ts` (ligne ~135)

**Cause:** En mode Satellite ou custom styles, les icônes custom (`marker-15`, `heart-15`, etc.) ne sont pas dans le sprite Mapbox natif. Le système ajoute automatiquement un fallback → comportement **normal**.

**Impact:** Console affichait `⚠️ marker-15 not in sprite, using fallback`

---

### 3️⃣ Ligne fantôme map-zone-left
**Source:** `styles.css` (ligne ~1169)

**Cause:** `.map-zone-left` existait dans le DOM avec style glass visible (background, border, backdrop-filter) mais était vide → overlay fantôme de 260×18px sur la map.

**Impact:** Ligne/artefact visuel en haut à gauche de la map

---

## ✅ SOLUTIONS APPLIQUÉES

### 1️⃣ Silence warnings superseded runs
**Fichier:** `src/pages/MapRoute.tsx`

**Changements:**
```typescript
// AVANT
if (currentRunId !== initRunIdRef.current) {
  console.warn(`[INIT] ⚠️ Retry from run #${currentRunId} aborted (superseded by #${initRunIdRef.current})`);
  return;
}

// APRÈS
if (currentRunId !== initRunIdRef.current) {
  // ✅ Silent abort: normal behavior in React dev (StrictMode double-invoke, HMR)
  return;
}
```

**Impact:** Zero warnings pour comportement normal. Seules les vraies erreurs sont loggées.

---

### 2️⃣ Icônes fallback = comportement normal, pas warning
**Fichier:** `src/utils/mapboxIcons.ts`

**Changements:**
```typescript
// AVANT
if (verbose) {
  console.warn(`[ICONS] ⚠️ ${iconName} not in sprite, using fallback`);
}

// APRÈS
if (verbose) {
  // ✅ Silent: This is normal behavior, especially for satellite/custom styles
  console.log(`[ICONS] 💡 ${iconName} not in sprite, using fallback`);
}
```

**Impact:** Info level au lieu de warning. Mode verbose uniquement (DEV).

---

### 3️⃣ Neutralisation map-zone-left fantôme
**Fichier:** `src/styles.css`

**Changements:**
```css
.map-zone-left {
  top: 120px;
  left: 18px;
  width: min(260px, 76vw);
  align-items: flex-start;
  /* 🧬 NEUTRALISATION FANTÔME — slot UI inutilisé pour le moment */
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  height: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  pointer-events: none !important;
}
```

**Impact:** 
- Invisible (background, border, shadow neutralisés)
- Non-cliquable (pointer-events: none)
- Hauteur zéro (height: 0)
- Structure DOM préservée (système layout modulaire intact)

**Réactivation future:** Supprimer le bloc de neutralisation quand un vrai panneau gauche sera implémenté (HUD rituel, sidebar Pro, etc.)

---

## 🧬 ARCHITECTURE CONFIRMÉE

### Toggle Style (Satellite/Night) ✅
**Confirmation:** Le système utilise correctement `map.setStyle()` sans recréer la map.

**Code:** `src/components/MapView.tsx` (ligne ~792)
```typescript
useEffect(() => {
  const map = mapRef.current;
  if (!map) return;
  if (lastStyleUrlRef.current === resolvedStyleUrl) return;
  lastStyleUrlRef.current = resolvedStyleUrl;
  controlsAddedRef.current = false;
  try {
    map.setStyle(resolvedStyleUrl);
  } catch (error) {
    console.error("[UQ][MAP_STYLE_CHANGE_ERR]", error);
  }
}, [resolvedStyleUrl]);
```

**Flux:**
1. User clique sur bouton Satellite/Night dans MapProPanel
2. `handleStyleChange(value)` → `setMapStyle(value)`
3. MapRoute passe `styleUrl={STYLE_URLS[mapStyle]}` à MapView
4. MapView détecte changement de `resolvedStyleUrl`
5. Appel `map.setStyle(newUrl)` — **une seule instance map, pas de re-init**
6. Event `style.load` déclenché → layers re-initialisés automatiquement

**Zéro réinit.** Map créée une seule fois.

---

## 📊 RÉSULTAT FINAL

### Console en DEV mode
✅ Zero warnings non-critiques  
✅ Seuls les vrais errors sont affichés  
✅ Info logs présents (verbose), pas de spam  

### Console en PROD mode
✅ Silence total (seuls les errors critiques)  
✅ Monitoring propre (pas de faux positifs)

### UI Map
✅ Zero artefact visuel (map-zone-left neutralisée)  
✅ Toggle style Satellite/Night fluide (setStyle, pas re-init)  
✅ Icônes fallback automatiques (styleimagemissing handler actif)

---

## 🛠️ MAINTENANCE FUTURE

### Si warnings [INIT] réapparaissent
**Check:** 
1. React StrictMode activé ? (normal en dev)
2. HMR déclenche double-render ? (normal Vite dev)
3. Un nouveau `useEffect` relance `initializeSpotSources` ?

**Solution:** Garder les checks `currentRunId !== initRunIdRef.current` mais **silent return**.

---

### Si warnings [ICONS] réapparaissent
**Check:**
1. Nouveau style custom ajouté ?
2. Nouvelles icônes demandées dans layers ?

**Solution:** Ajouter les nouvelles icônes dans `ICON_SVGS` (mapboxIcons.ts).

---

### Si map-zone-left redevient visible
**Check:**
1. CSS modifié ailleurs (ordre de priorité) ?
2. Un JS enlève les `!important` ?

**Solution:** Vérifier ordre CSS (neutralisation doit être après définition de base).

---

## 🎯 NIVEAU INVESTISSEUR

**Avant:**
- Console polluée de warnings non-critiques
- Ligne fantôme sur la map
- Perception "beta instable"

**Après:**
- Console pure, zero bruit
- Map visuelle propre
- Perception "production-grade"

✅ **Ready for demo / pitch / review.**
