# 📜 ARCHIVES MODE - Hardening Complete

## ✅ Problème résolu : OHM CORS Spam

**Avant :** OpenHistoricalMap (OHM) tiles créées au boot → CORS errors en localhost

**Après :** Modèle 2 layers + lazy loading OHM

---

## 🏗️ Architecture finale

### 1. **Constants (2 layers)**
```typescript
const ARCHIVES_RASTER_LAYER_FALLBACK = "uq-archives-raster-layer-fallback";
const ARCHIVES_RASTER_LAYER_OHM = "uq-archives-raster-layer-ohm";
```

### 2. **Init (boot time)**
- ✅ **Source FALLBACK** : Créée immédiatement (Stamen Toner Lite - stable, no CORS)
- ✅ **Layer FALLBACK** : Créée immédiatement (visibility: "none")
- ❌ **Source OHM** : PAS créée (lazy loading)
- ❌ **Layer OHM** : PAS créée (lazy loading)

### 3. **State initial**
```typescript
const [archivesSource, setArchivesSource] = useState<"ohm" | "fallback">("fallback");
```

### 4. **Effect de visibilité (toggle + opacity)**
```typescript
// Si archivesSource === "ohm" → créer source + layer on-demand
if (archivesSource === "ohm" && !mapInstance.getSource(ARCHIVES_RASTER_SOURCE_OHM)) {
  mapInstance.addSource(...);
  mapInstance.addLayer(...);
}

// Toggle visibility (2-layer model, zéro re-create)
if (archivesSource === "fallback") {
  setVisibility(FALLBACK, "visible");
  setVisibility(OHM, "none");
} else {
  setVisibility(OHM, "visible");
  setVisibility(FALLBACK, "none");
}
```

---

## 🎯 Bénéfices

1. **Zéro requête OHM** si l'utilisateur reste sur "Papier" (fallback)
2. **Pas de CORS spam** en localhost (OHM hidden = no tile loading)
3. **Pas de re-create** coûteux quand on switch source (juste visibility toggle)
4. **Production-ready** : OHM fonctionne avec un vrai domaine (pas de CORS en prod)

---

## 🧪 Test de validation

### DevTools → Network (filtre: openhistoricalmap)

1. **Active 📜 ARCHIVES** (reste sur "Papier")
   - ✅ Attends : **0 requête OHM**
   - ✅ Vois : Tiles Stamen Toner Lite

2. **Switch vers "Historique"** (si PROD ou force en dev)
   - ✅ Attends : Requêtes OHM **uniquement après switch**
   - ❌ PAS de requêtes OHM pendant le boot initial

---

## 🎨 UX améliorée

### En DEV (localhost)
- Bouton "Historique" **caché** (CORS issues)
- Message : "(Mode Historique disponible en production)"
- Seul bouton visible : "Papier" (stable)

### En PROD
- Deux boutons : "Historique" et "Papier"
- OHM fonctionne (pas de CORS avec vrai domaine)

### Hint interactif
```
Clique sur la carte pour découvrir l'histoire autour de ce point.
```
Affiché quand aucune archive card n'est chargée.

---

## 📊 Performance

| Métrique | Avant | Après |
|----------|-------|-------|
| **Boot requests** | ~40 OHM tiles | 0 OHM tiles |
| **CORS errors** | ~40 errors | 0 errors |
| **Switch source** | removeLayer + addLayer | setVisibility (instant) |
| **Memory** | 2 sources chargées | 1 source active |

---

## 🔒 Garanties

✅ **OHM ne charge JAMAIS** si :
- archivesSource === "fallback"
- historyMode !== "archives"
- historyActive === false

✅ **Fallback toujours stable** (Stamen Toner Lite, no CORS)

✅ **Wikipedia GeoSearch** fonctionne avec `origin=${window.location.origin}`

---

## 🚀 Prochaine étape (Task 8)

**THEN/NOW hold-to-compare button**
- Maintenir bouton → opacity = 0 (voir la carte moderne)
- Relâcher → restore opacity (retour au vintage)
- Visual feedback pendant hold

```typescript
const handleNowPress = () => {
  savedOpacityRef.current = archivesOpacity;
  onArchivesOpacityChange?.(0);
  setIsHoldingNow(true);
};
```

---

**Status:** ✅ ARCHIVES MODE - Hardening Complete
**Date:** 2026-01-14
**Sprint:** C1 (ARCHIVES)
