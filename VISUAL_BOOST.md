# 🎯 Renforcement Visuel – Pins à Impact Maximum

## Objectif Produit
Les markers doivent **s'imposer visuellement** sur la map sombre, pas se fondre.  
Résultat : pins **solides, lisibles, immédiatement identifiables** sans hover.

---

## Changements Visuels Appliqués

### 1. Taille des Pins (Circle Radius)
**Avant :** 6px → 10px → 14px  
**Après :** **8px → 12px → 16px**  
✅ +33% de surface visuelle  
✅ Présence renforcée à tous les niveaux de zoom

---

### 2. Épaisseur du Contour (Stroke Width)
**Avant :** 0.8px → 1.2px → 1.8px  
**Après :** **1.5px → 2.5px → 3.5px**  
✅ Contour 2× plus épais  
✅ Pins "cernés" de lumière, pas esquissés

---

### 3. Opacité Générale (Circle Opacity)
**Avant :** 0.3 → 0.6 → 0.9 (fantôme → présent)  
**Après :** **0.7 → 0.95 → 1.0** (présent → plein)  
✅ Visible dès le zoom distant  
✅ Pins assumés, pas timides

---

### 4. Opacité du Contour (Stroke Opacity)
**Avant :** Variable 0.4 → 0.7 → 1.0 (progressif)  
**Après :** **Constant 1.0** (plein)  
✅ Contour toujours à contraste max  
✅ Pas de "fade" = impact constant

---

### 5. Couleur de Remplissage (Circle Color)
**COMMON :**  
- Avant : `rgba(255, 255, 255, 0.03)` (quasi invisible)  
- Après : **`rgba(255, 255, 255, 0.15)`** (semi-opaque)

**EPIC :**  
- Avant : `rgba(255, 211, 92, 0.08)` (suggéré)  
- Après : **`rgba(255, 211, 92, 0.25)`** (affirmé)

**GHOST :**  
- Avant : `rgba(184, 253, 255, 0.06)` (éthéré)  
- Après : **`rgba(184, 253, 255, 0.2)`** (lumineux)

✅ Remplissage visible = pins "solides"  
✅ Pas juste un contour = présence réelle

---

### 6. Contour Couleur COMMON
**Avant :** `rgba(255, 255, 255, 0.4)` (gris fade)  
**Après :** **`rgba(255, 255, 255, 0.85)`** (blanc éclatant)  
✅ Spots COMMON maintenant aussi visibles que les tiers spéciaux

---

### 7. Icônes Géométriques (Symbol Layer)
**Text Size :**  
- Avant : 10px  
- Après : **14px** (+40%)

**Text Opacity :**  
- Avant : 0.8  
- Après : **1.0** (opaque)

**Text Allow Overlap :**  
- Avant : `false` (peut disparaître si collision)  
- Après : **`true`** (toujours affiché)

**Text Color COMMON :**  
- Avant : `rgba(255, 255, 255, 0.6)`  
- Après : **`rgba(255, 255, 255, 0.95)`**

✅ Symboles architecturaux plus gros et toujours visibles au zoom proche

---

## Comparaison Visuelle

### Avant (Subtil/Ghost)
```
Zoom distant : ○ (à peine visible)
Zoom moyen   : ◯ (présent mais discret)
Zoom proche  : ◉ (architectural mais soft)
```

### Après (Impact/Présence)
```
Zoom distant : ● (clairement visible)
Zoom moyen   : ⬤ (présence forte)
Zoom proche  : ⬤ (solide + symbole architectural)
```

---

## Architecture Technique
✅ **ZERO changement de logique**  
✅ Même layers (spots-circle + spots-icon)  
✅ Même tiers (COMMON / EPIC / GHOST)  
✅ Même zoom scaling  
✅ Même click handlers  
✅ Même source GeoJSON

**Uniquement modifié :** propriétés `paint` dans `markerIntegration.tsx`

---

## Test Maintenant

```bash
# Hard refresh browser
Cmd + Shift + R (Mac)
Ctrl + F5 (Windows)
```

### Checklist Visuelle
1. **Zoom out (niveau 9-11) :** pins clairement visibles sur fond sombre ✓
2. **COMMON spots :** blanc éclatant, pas gris fade ✓
3. **EPIC spots :** or lumineux avec remplissage visible ✓
4. **GHOST spots :** cyan brillant avec présence forte ✓
5. **Zoom in (13+) :** symboles architecturaux (▮ ▲ ╬ ⌂ ■) bien lisibles ✓

---

## Si Encore Trop Subtil

Tu peux pousser encore plus :

### Option 1 : Encore Plus Gros
```tsx
"circle-radius": [
  "interpolate", ["linear"], ["zoom"],
  9, 10,  // Currently 8
  12, 15, // Currently 12
  15, 20  // Currently 16
]
```

### Option 2 : Contour Ultra-Épais
```tsx
"circle-stroke-width": [
  "interpolate", ["linear"], ["zoom"],
  9, 2.0,  // Currently 1.5
  12, 3.5, // Currently 2.5
  15, 5.0  // Currently 3.5
]
```

### Option 3 : Remplissage Plus Dense
```tsx
// COMMON fill
"rgba(255, 255, 255, 0.3)"  // Currently 0.15

// EPIC fill
"rgba(255, 211, 92, 0.4)"   // Currently 0.25

// GHOST fill
"rgba(184, 253, 255, 0.35)" // Currently 0.2
```

---

## Prochaines Itérations (si besoin)

1. **Glow effect** : ajouter `circle-blur` pour aura lumineuse
2. **Drop shadow** : effet de relief CSS sur la map
3. **Pulse animation** : pour spots EPIC/GHOST (via expressions Mapbox)
4. **Custom sprites** : remplacer formes géométriques par icônes SVG

Mais là, tu devrais déjà avoir des pins **qui claquent** 🎯

---

**Fichier modifié :** `src/examples/markerIntegration.tsx` (lignes ~48-147)  
**Build status :** ✅ 0 errors  
**Date :** 5 janvier 2026
