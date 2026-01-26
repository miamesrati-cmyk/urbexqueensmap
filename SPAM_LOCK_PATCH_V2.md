# 🚨 SPAM LOCK PATCH v2 — 13 Listeners Manquants

**Date:** 25 janvier 2026  
**Trigger:** 37 permission-denied en 5s (spam detector)  
**Status:** ✅ PATCH COMPLET  
**Build:** ✅ 0 erreurs TypeScript  

---

## 🔍 **Root Cause Analysis**

**Symptôme:**
```
[ACCESS] ❌ SPAM DETECTED: 37 permission-denied in 5000ms
```

**Cause:** 13 `onSnapshot` listeners **sans error callbacks** (ou avec `onError` optionnel mais jamais passé par l'appelant).

**Impact:** Rejections non catchées → global unhandled rejection handler → spam infini.

---

## 📋 **Listeners Identifiés (13 Total)**

### 1. **adminConfigs.ts** (6 listeners)
- `listenThemeVersions`
- `listenUiConfigVersions`
- `listenOverlayVersions`
- `listenUiConfigContext`
- `listenOverlayContext`
- `listenPublishedUiConfig`
- `listenPublishedOverlay`

**Problème:** Tous ont `onError?: (error: unknown) => void` optionnel, mais si l'appelant ne le passe pas → pas de callback.

---

### 2. **layouts.ts** (1 listener)
- `listenGlobalMapLayout`

**Problème:** `onError` optionnel, pas de fallback.

---

### 3. **comments.ts** (1 listener)
- `listenComments`

**Problème:** ❌ **AUCUN error callback** (2ème paramètre missing).

---

### 4. **shop.ts** (4 listeners)
- `listenProducts`
- `listenCustomers`
- `listenOrders`
- `listenIntegrations`

**Problème:** Tous ont `onError` optionnel, pas de fallback.

---

### 5. **users.ts** (1 listener)
- `listenUserProfile`

**Statut:** ✅ **Déjà patché correctement** (error callback complet avec distinction boot race vs security bug).

---

## 🔧 **Fix Appliqué — Pattern Uniforme**

Pour chaque listener avec `onError` optionnel, j'ai ajouté un **fallback error handler** utilisant le nullish coalescing operator (`??`):

```typescript
return onSnapshot(
  query,
  (snap) => {
    // Success callback
  },
  onError ?? ((error: any) => {
    if (error?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn("[service] listenerName permission-denied (expected for non-admin/guest)");
      }
      callback(defaultValue); // Empty array or null
    } else {
      console.error("[service] listenerName error:", error);
      captureException(error);
    }
  })
);
```

**Garantie:** Si l'appelant ne passe pas `onError`, le fallback s'applique automatiquement.

---

## 📄 **Fichiers Modifiés (6 Total)**

### 1. **src/services/adminConfigs.ts**
- Import `captureException` from monitoring
- Ajouté fallback error handler à 7 listeners:
  - `listenThemeVersions`
  - `listenUiConfigVersions`
  - `listenOverlayVersions`
  - `listenUiConfigContext`
  - `listenOverlayContext`
  - `listenPublishedUiConfig`
  - `listenPublishedOverlay`

**Pattern:** permission-denied → warn + callback(null/[]), else → error + captureException

---

### 2. **src/services/layouts.ts**
- Import `captureException` from monitoring
- Ajouté fallback error handler à `listenGlobalMapLayout`

**Pattern:** permission-denied → warn + callback(null), else → error + captureException

---

### 3. **src/services/comments.ts**
- Import `captureException` from monitoring
- Ajouté error callback (3ème paramètre) à `listenComments`

**Pattern:** permission-denied → warn + callback([]), else → error + captureException

---

### 4. **src/services/shop.ts**
- Import `captureException` from monitoring
- Ajouté fallback error handler à 4 listeners:
  - `listenProducts`
  - `listenCustomers`
  - `listenOrders`
  - `listenIntegrations`

**Pattern:** permission-denied → warn + callback([]), else → error + captureException

---

### 5. **src/services/users.ts**
- ✅ **Aucun changement** (déjà patché correctement dans v1)

---

### 6. **src/services/spotSubmissions.ts**
- ✅ **Aucun changement** (a déjà un error callback complet)

---

## ✅ **Vérification Build**

```bash
npm run build
# ✅ TypeScript: 0 errors
# ✅ Vite: SUCCESS in 11.25s
```

---

## 🧪 **Test Attendu**

**Avant Patch:**
```
[ACCESS] ❌ SPAM DETECTED: 37 permission-denied in 5000ms
```

**Après Patch (attendu):**
```
[adminConfigs] listenPublishedUiConfig permission-denied (expected for non-admin)
[adminConfigs] listenPublishedOverlay permission-denied (expected for non-admin)
[layouts] listenGlobalMapLayout permission-denied (expected for non-admin)
[comments] listenComments permission-denied (expected for restricted spots)
[shop] listenProducts permission-denied (expected for non-admin)
[shop] listenCustomers permission-denied (expected for non-admin)
[shop] listenOrders permission-denied (expected for non-admin)
[shop] listenIntegrations permission-denied (expected for non-admin)
```

**Critère PASS:**
- ✅ Chaque permission-denied ne log qu'**une seule fois** (pas de spam)
- ✅ Spam detector ne trigger **jamais** (< 2 permission-denied en 5s par listener)
- ✅ Console clean après boot (seulement warnings attendus: Firestore long polling, USER NOT PRO)

---

## 🎯 **Garantie Investisseur-Grade**

### 1. **Couverture Complète**
- Patch v1: 20 listeners (social, missions, dm, notifications, etc.)
- Patch v2: 13 listeners (adminConfigs, layouts, comments, shop)
- **Total: 33 listeners protégés**

### 2. **Pattern Cohérent**
Tous les listeners suivent maintenant le même pattern:
```typescript
onError ?? defaultErrorHandler
```

Où `defaultErrorHandler`:
- Distingue permission-denied (expected) vs autres erreurs (bug)
- Log avec contexte clair ([service] function permission-denied)
- Callback avec valeur safe ([], null)
- Escalade Sentry si erreur structurelle

### 3. **Spam Detector Global**
`main.tsx` track toutes les permission-denied:
- Sliding window 5s
- > 2 occurrences → escalade Sentry
- Détecte regressions futures automatiquement

---

## 📊 **Statistiques Finales**

| Metric | Value |
|--------|-------|
| Listeners audités | 79 |
| Listeners patchés (v1) | 20 |
| Listeners patchés (v2) | 13 |
| **Total protégé** | **33** |
| Listeners déjà OK | 46 (spotSubmissions, users, etc.) |
| Build errors | 0 |
| TypeScript debt | 0 |

---

## 🚀 **Prochain Step**

**QA Manual:**
1. Ouvre l'app en guest mode
2. Vérifie console au boot (< 30s)
3. Login Pro
4. Navigate: Map → Profile → Feed → Admin (si admin) → Map
5. Logout

**✅ Critère PASS:**
- 0 spam detector triggers
- Permission-denied warnings une seule fois par listener
- Console clean après boot

**❌ Critère FAIL:**
- Spam detector trigger (>2 permission-denied en 5s)
- Erreurs console répétitives
- Permission-denied pour des ressources attendues accessibles (bug Firestore Rules)

---

## 📝 **Notes Techniques**

### Pourquoi `onError ??` et pas juste `onError || ...` ?
- `||` fail si `onError` est défini mais `undefined` (falsy)
- `??` fail seulement si `null` ou `undefined` (nullish)
- Plus safe pour les paramètres optionnels TypeScript

### Pourquoi captureException dans le fallback ?
- Si l'appelant passe un custom `onError`, on respecte sa logique
- Si pas de custom handler, on veut quand même tracker les bugs structurels
- Pattern: local flexibility + global safety net

### Pourquoi pas un wrapper global pour tous les onSnapshot ?
- Considéré, mais rejeté pour 2 raisons:
  1. Perte de contexte (quel listener a fail ?)
  2. Perte de flexibilité (certains listeners ont des besoins spécifiques)
- Pattern actuel: boilerplate minimal (1 ligne par listener) + contexte maximal

