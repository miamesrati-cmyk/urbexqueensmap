# 🎯 TIME RIFT V4 - Phase 1: Ajouter des Années Historiques

**Objectif:** Rendre les era filters utiles en ajoutant de vraies années d'abandon  
**Durée:** 2 minutes pour 5 spots (validation)  
**Méthode:** Manuel dans Firebase Console (puis UI plus tard)

---

## ✅ Quick Start (5 spots en 2 minutes)

### 1. Ouvre Firebase Console

1. Va sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionne ton projet: **urbexqueenscanada**
3. Menu gauche → **Firestore Database**
4. Collection → **places**

### 2. Ajoute le champ `yearAbandoned`

Pour chaque spot (fais-en 5 pour commencer) :

1. **Clique sur un document spot**
2. **Add field**
   - Field name: `yearAbandoned`
   - Field type: `number`
   - Value: `1998` (ou l'année réelle si tu la connais)
3. **Save**

### 3. Exemples de valeurs

| Type de lieu | Année suggérée | Era Bucket |
|--------------|----------------|------------|
| Usine | 1985 | 1980-1999 |
| Hôpital | 1975 | Pre-1980 |
| Maison | 2007 | 2000-2009 |
| École | 2012 | 2010-2015 |
| Centre commercial | 2018 | 2016-2020 |

---

## 🧪 Test (10 secondes)

1. **Refresh l'app** (http://localhost:5174)
2. **Ouvre Time Rift** → **Intelligence**
3. **Clique les era pills** :
   - `Pre-1980` → devrait montrer les spots <1980
   - `1980-1999` → devrait montrer les spots 1980-1999
   - etc.

**Console logs :**
```
📊 Filtered spots: 2 / 11  ← Plus 0 !
📊 Sample spots (first 3):
  - "Usine abandonnée" | Year: 1985  ← Plus "unknown" !
```

---

## 📊 Résultats Attendus

### AVANT (sans yearAbandoned)
```
All: 11 spots ✅
Pre-1980: 0
1980-1999: 0
2000-2009: 0
...
```

### APRÈS (avec 5 spots ayant yearAbandoned)
```
All: 11 spots ✅
Pre-1980: 1 spot (hôpital 1975)
1980-1999: 2 spots (usine 1985, maison 1998)
2000-2009: 1 spot (école 2007)
2010-2015: 1 spot (centre 2012)
```

---

## 🚀 Phase 2 (Plus Tard) : UI d'Édition

Quand tu voudras automatiser, ajoute simplement dans ton formulaire spot :

```tsx
<div>
  <label>Année d'abandon (estimée)</label>
  <input 
    type="number" 
    placeholder="Ex: 1998"
    min="1800"
    max={new Date().getFullYear()}
    value={yearAbandoned || ""}
    onChange={(e) => setYearAbandoned(parseInt(e.target.value) || null)}
  />
  <small>Optionnel - Permet le filtrage par ère historique</small>
</div>
```

Ça écrit direct dans Firestore → era filters s'alimentent naturellement.

---

## 💡 Bonus UX (Optionnel)

### Si tu veux afficher un message quand era = 0 spots

Dans `TimeRiftPanel.tsx`, après les era pills :

```tsx
{era !== "all" && filteredCount === 0 && (
  <div className="time-rift-hint">
    <small>
      💡 Aucun spot dans cette période. Ajoute un champ 
      <code>yearAbandoned</code> dans Firestore pour activer les filtres historiques.
    </small>
  </div>
)}
```

Ça transforme "ça marche pas" en "voilà comment l'activer" (UX investisseur).

---

## ✅ Success Criteria

Tu sauras que ça marche quand :

1. ✅ Console log: `Filtered spots: X / Y` (X > 0 pour au moins 1 era)
2. ✅ Heatmap/glow visible change quand tu switches d'era
3. ✅ Sample spots montrent: `Year: 1985` (pas `unknown`)

---

**Fais 5 spots maintenant, refresh, teste les era pills. Ça devrait marcher immédiatement !** 🎯
