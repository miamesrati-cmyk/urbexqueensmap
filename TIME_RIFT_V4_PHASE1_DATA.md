# 🎯 TIME RIFT V4 - Phase 1: Ajouter des Années Historiques

**Date:** January 14, 2026  
**Objectif:** Rendre les era filters utiles avec de vraies données  
**Durée:** 5 minutes pour 5 spots

---

## ✅ Méthode 1 : Firebase Console (Le plus rapide)

### Étape 1 : Ouvre Firebase Console

1. Va sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionne ton projet : `urbexqueenscanada`
3. Menu **Firestore Database**

### Étape 2 : Ajoute le champ `yearAbandoned`

Pour chaque spot (commence par 5 spots de test) :

1. **Clique sur un document** dans la collection `places`
2. **Add field** (bouton +)
3. **Field name :** `yearAbandoned`
4. **Type :** `number`
5. **Value :** L'année estimée d'abandon (ex: `1998`)
6. **Save**

### Exemples de valeurs selon le type :

| Type de lieu | Année estimée | Bucket |
|--------------|---------------|--------|
| Usine textile | 1975 | Pre-1980 |
| Hôpital abandonné | 1993 | 1980-1999 |
| Maison déserte | 2005 | 2000-2009 |
| Centre commercial | 2012 | 2010-2015 |
| Bureau fermé COVID | 2020 | 2016-2020 |
| Restaurant récent | 2023 | 2021+ |

### Étape 3 : Teste dans l'app

1. Ouvre `http://localhost:5174` (ou ton URL de prod)
2. Time Rift → 🧠 Intelligence
3. Clique sur les era pills (Pre-1980, 1980-1999, etc.)
4. **Résultat attendu :** Tu verras maintenant des spots dans ces catégories

---

## ✅ Méthode 2 : Script Firestore (Pour mettre à jour plusieurs spots)

Si tu as beaucoup de spots à mettre à jour, utilise ce script :

### Script Node.js (à lancer depuis `functions/` ou un script isolé)

```javascript
const admin = require('firebase-admin');

// Initialize (si pas déjà fait)
admin.initializeApp();
const db = admin.firestore();

// Map spot IDs vers années estimées
const updates = {
  'spot-id-1': 1998,  // Usine
  'spot-id-2': 2005,  // Maison
  'spot-id-3': 1975,  // Hôpital
  'spot-id-4': 2020,  // Bureau
  'spot-id-5': 2012,  // Centre commercial
};

async function updateYears() {
  const batch = db.batch();
  
  for (const [spotId, year] of Object.entries(updates)) {
    const ref = db.collection('places').doc(spotId);
    batch.update(ref, { yearAbandoned: year });
  }
  
  await batch.commit();
  console.log(`✅ Updated ${Object.keys(updates).length} spots`);
}

updateYears();
```

**Run :**
```bash
cd functions
node update-years.js
```

---

## 📊 Résultat Attendu

Après ajout de `yearAbandoned` sur 5 spots :

**Console logs :**
```
📊 Sample spots (first 3):
  - "Usine Textile" | Year: 1975  ← Plus "unknown" !
  - "Hôpital St-Jean" | Year: 1993
  - "Maison Dupont" | Year: 2005
```

**Era Pills dans l'app :**
```
All: 11 spots
Pre-1980: 1 spot (Usine Textile)
1980-1999: 1 spot (Hôpital St-Jean)
2000-2009: 1 spot (Maison Dupont)
2010-2015: 0 spots
2016-2020: 1 spot (Bureau fermé)
2021+: 1 spot (Restaurant)
```

**Overlay Mapbox :**
- Clique **Pre-1980** → heatmap montre seulement l'usine
- Clique **1980-1999** → heatmap montre seulement l'hôpital
- Clique **All** → heatmap montre tout

---

## 🚀 Phase 2 (Plus tard) : UI d'Édition

Quand tu voudras éviter l'ajout manuel, ajoute un champ dans ton formulaire :

### Dans `CreateSpotModal.tsx` ou équivalent :

```tsx
<label>
  Année d'abandon estimée (optionnel)
  <input
    type="number"
    min="1800"
    max="2026"
    placeholder="Ex: 1995"
    value={yearAbandoned}
    onChange={(e) => setYearAbandoned(parseInt(e.target.value) || null)}
  />
</label>
```

### Dans la soumission :

```typescript
await createPlace({
  ...otherFields,
  yearAbandoned: yearAbandoned || null, // Optionnel
});
```

**Résultat :** Les utilisateurs peuvent ajouter l'année directement quand ils créent un spot.

---

## 🎨 Bonus UX : Message "No Data"

Si un era filter est vide, affiche un message clair dans le panel :

```typescript
{mode === "intelligence" && era !== "all" && intelSpots.length === 0 && (
  <div className="time-rift-empty-state">
    <p>Aucun spot trouvé pour cette période</p>
    <small>Ajoutez "yearAbandoned" dans Firestore pour activer ce filtre</small>
  </div>
)}
```

---

## ✅ Checklist

- [ ] Ouvre Firebase Console → Firestore → collection `places`
- [ ] Ajoute `yearAbandoned` (number) sur 5 spots de test
- [ ] Choisis des années variées (1975, 1993, 2005, 2012, 2020)
- [ ] Refresh l'app
- [ ] Time Rift → Intelligence → Era Pills
- [ ] Vérifie que chaque pill montre le bon nombre de spots
- [ ] Console log montre `Year: 1975` (pas "unknown")
- [ ] Overlay heatmap change selon l'era sélectionnée

---

**Go ! Ajoute 5 années et teste. L'overlay va devenir utile instantanément.** 🎯
