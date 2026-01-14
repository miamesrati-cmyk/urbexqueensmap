# 🔍 TIME RIFT V4 - Diagnostic Express (30 secondes)

**Date:** January 14, 2026  
**Objectif:** Identifier EXACTEMENT pourquoi l'overlay ne s'affiche pas  
**Durée:** 30 secondes

---

## 🚀 Étape 1 : Active le flag (obligatoire)

**Fichier:** `.env.local`

```bash
# Change cette ligne
VITE_TIME_RIFT_INTELLIGENCE_ENABLED=true
```

**Ensuite:**
```bash
# Redémarre (CTRL+C puis)
npm run dev
```

---

## 🔍 Étape 2 : Ouvre la Console (CRITIQUE)

1. **Ouvre l'app** : `http://localhost:5174`
2. **Ouvre DevTools** : `F12` ou `Cmd+Option+I` (Mac)
3. **Onglet Console**

---

## 📊 Étape 3 : Lis les logs automatiques

Dès que la page charge, tu verras un bloc comme ça :

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕰️ TIME RIFT V4 - INTELLIGENCE MODE DIAGNOSTIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ENV FLAG: "true"
🔧 isIntelligenceModeEnabled(): true
👑 isPro: true
👤 User: ton-email@example.com
🎯 showIntelligenceMode (chip visible): true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ INTELLIGENCE MODE AVAILABLE → 🧠 chip should be visible
```

---

## 🎯 Décision Rapide (lis SEULEMENT ces lignes)

### Cas A : `isPro: false`

```
👑 isPro: false
⚠️ USER NOT PRO → Intelligence chip hidden (PRO required)
```

**➡️ PROBLÈME : Ton user n'est pas reconnu PRO**

**Solution immédiate :**
1. Va dans Firebase Console → Firestore
2. Collection `users` → trouve ton user (par email)
3. Vérifie champ `isPro` ou `subscription.status`
4. Si manquant/false → mets à `true` manuellement
5. Refresh l'app

---

### Cas B : `ENV FLAG: undefined`

```
📊 ENV FLAG: undefined
⚠️ FLAG OFF → Enable in .env.local
```

**➡️ PROBLÈME : Le flag n'est pas lu**

**Solutions :**
1. Vérifie que `.env.local` existe à la racine (pas dans `src/`)
2. Vérifie la ligne exacte :
   ```bash
   VITE_TIME_RIFT_INTELLIGENCE_ENABLED=true
   ```
   (pas d'espace autour du `=`)
3. Redémarre le serveur (important !)

---

### Cas C : `showIntelligenceMode: false` (malgré flag + PRO)

```
🔧 isIntelligenceModeEnabled(): true
👑 isPro: true
🎯 showIntelligenceMode (chip visible): false  ← WTF
```

**➡️ PROBLÈME : Bug dans la condition**

**Fix rapide :**
Ouvre `MapRoute.tsx` ligne ~3100, cherche :
```typescript
showIntelligenceMode={isIntelligenceModeEnabled() && isPro}
```

Remplace temporairement par :
```typescript
showIntelligenceMode={true}  // DEBUG FORCÉ
```

Si le chip apparaît → c'est un bug de timing (isPro pas encore chargé).

---

### Cas D : ✅ TOUT EST BON mais pas d'overlay

```
✅ INTELLIGENCE MODE AVAILABLE → 🧠 chip should be visible
```

**➡️ Le chip 🧠 INTELLIGENCE devrait être visible dans le panel Time Rift**

**Action :**
1. Clique Time Rift button (top-right)
2. Tu vois 4 chips : ARCHIVES / DECAY / THEN-NOW / **🧠 INTELLIGENCE**
3. Clique **🧠 INTELLIGENCE**

**Ensuite, regarde la console :**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕰️ TIME RIFT INTEL - OVERLAY UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 intelEnabled: true
📊 historyMode: "intelligence"
✅ historyActive: true
👑 isPro: true
🎯 shouldShowOverlay: true
🌍 timeRiftEra: "all"
📍 Total places: 42
📊 Filtered spots: 42 / 42
📊 GeoJSON features: 42
📊 Sample spots (first 3):
  - Spot A | Year: 2015
  - Spot B | Year: unknown
  - Spot C | Year: 1998
✅ OVERLAY VISIBLE: 42 spots (era: all)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🐛 Diagnostics Overlay (si chip visible mais rien à l'écran)

### Problème 1 : `Filtered spots: 0 / 42`

**➡️ Tous les spots sont filtrés (année manquante)**

**Solution :**
- Era `all` devrait TOUJOURS montrer tous les spots
- Si 0 spots → bug dans `filterSpotsByBucket`
- Check console : `⚠️ NO SPOTS after filter!`

**Fix rapide :**
Ouvre `timeRiftIntelligence.ts`, cherche `filterSpotsByBucket`, vérifie que `"all"` renvoie TOUS les spots sans filtrage.

---

### Problème 2 : `GeoJSON features: 42` mais rien visible

**➡️ L'overlay existe mais pas visible (zoom/opacity/colors)**

**Actions :**
1. **Zoom out** à niveau 8 (vue pays) → heatmap devrait être TRÈS visible
2. **Zoom in** à niveau 16 (vue rue) → glow circles devraient être visibles
3. Regarde les layers Mapbox dans DevTools :
   ```javascript
   map.getLayer('uq-time-rift-intel-heatmap')
   map.getLayer('uq-time-rift-intel-glow')
   ```
   Si `undefined` → layers pas créées (bug init)

---

### Problème 3 : Sample spots = `Year: unknown` pour tous

**➡️ Aucun spot n'a d'année → overlay vide ou all only**

**Solution produit :**
1. Court terme : Utilise `createdAt` comme fallback
2. Moyen terme : Ajoute un champ `yearApprox` dans Firestore
3. Long terme : Import de data historique avec années

**Fix technique :**
Ouvre `timeRiftIntelligence.ts`, fonction `getSpotYear()`, ajoute fallback :
```typescript
export function getSpotYear(spot: Place): number | null {
  if (spot.yearAbandoned) return spot.yearAbandoned;
  if (spot.yearLastSeen) return spot.yearLastSeen;
  // FALLBACK : Utilise l'année de création comme approximation
  if (spot.createdAt) {
    const date = new Date(spot.createdAt);
    return date.getFullYear();
  }
  return null;
}
```

---

## 📋 Checklist Rapide (copie-colle dans console)

```javascript
// 1. Flag enabled?
console.log("FLAG:", import.meta.env.VITE_TIME_RIFT_INTELLIGENCE_ENABLED);

// 2. Layers exist?
console.log("Heatmap layer:", map.getLayer('uq-time-rift-intel-heatmap'));
console.log("Glow layer:", map.getLayer('uq-time-rift-intel-glow'));

// 3. Source has data?
const src = map.getSource('uq-time-rift-intel');
console.log("Source features:", src._data.features.length);

// 4. Layers visible?
console.log("Heatmap visible:", map.getLayoutProperty('uq-time-rift-intel-heatmap', 'visibility'));
console.log("Glow visible:", map.getLayoutProperty('uq-time-rift-intel-glow', 'visibility'));
```

---

## 🎯 Arbre de Décision Ultra-Rapide

```
START
│
├─ Console log "USER NOT PRO" ?
│  └─ OUI → Fix Firestore user.isPro
│  └─ NON → Continue
│
├─ Console log "FLAG OFF" ?
│  └─ OUI → Fix .env.local + restart
│  └─ NON → Continue
│
├─ Chip 🧠 INTELLIGENCE visible ?
│  └─ NON → Check showIntelligenceMode logic
│  └─ OUI → Continue
│
├─ Console "Filtered spots: 0" ?
│  └─ OUI → Fix filterSpotsByBucket (era="all")
│  └─ NON → Continue
│
├─ Console "Sample spots: Year: unknown" (tous) ?
│  └─ OUI → Add fallback to createdAt
│  └─ NON → Continue
│
└─ Overlay existe mais invisible ?
   └─ Check zoom level (out=heatmap, in=glow)
   └─ Check layer visibility in DevTools
```

---

## ✅ Success Criteria

Tu sauras que ça marche quand :

1. ✅ Console montre : `✅ INTELLIGENCE MODE AVAILABLE`
2. ✅ Chip 🧠 INTELLIGENCE visible dans Time Rift panel
3. ✅ Console montre : `✅ OVERLAY VISIBLE: X spots`
4. ✅ Zoom out → tu vois heatmap purple/cyan
5. ✅ Zoom in → tu vois glow circles purple

---

## 🚨 Si RIEN ne marche après tout ça

**Copy-paste la console entière dans un message et je te donne le fix exact.**

Les logs automatiques montrent EXACTEMENT où est le problème.

---

**GO ! Test maintenant et dis-moi ce que tu vois dans la console** 🎯
