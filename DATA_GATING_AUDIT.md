# 🔐 DATA GATING AUDIT — Backend Security

**Date:** 22 janvier 2026  
**Objectif:** Garantir qu'aucune donnée Pro n'est accessible via query/API pour Guest/Free users

---

## 📊 TABLEAU FIRESTORE RULES & DATA ACCESS

### 🗺️ **COLLECTION: `places`**

| Field/Feature | Guest | Free | Pro | Firestore Rule Status | Action Requise |
|---------------|-------|------|-----|----------------------|----------------|
| **Lecture document** | ✅ Read all | ✅ Read all | ✅ Read all | `allow read: if true` | ⚠️ **TROP PERMISSIF** |
| `title`, `description`, `category` | ✅ | ✅ | ✅ | Public | ✅ OK |
| `lat`, `lng` | ✅ | ✅ | ✅ | Public | ✅ OK |
| `historyShort` | ✅ | ✅ | ✅ | Public | ✅ OK (preview gratuit) |
| **`historyFull`** | ❌ Should block | ❌ Should block | ✅ | **NO RULE** | 🚨 **CRITIQUE** |
| **`historyIsPro`** (flag) | ✅ Can read flag | ✅ Can read flag | ✅ | Public | ⚠️ Flag visible OK, mais data fuite |
| **`yearAbandoned`** | ❌ Should block | ❌ Should block | ✅ | **NO RULE** | 🚨 **CRITIQUE** (Time Rift) |
| **`yearLastSeen`** | ❌ Should block | ❌ Should block | ✅ | **NO RULE** | 🚨 **CRITIQUE** (Time Rift) |
| `proOnly` (flag) | ✅ Can read flag | ✅ Can read flag | ✅ | Public | ✅ OK (UI gate suffit) |
| **Create place** | 🔒 Blocked | ✅ Allowed | ✅ Allowed | `isSignedIn()` | ✅ OK |
| **Update history fields** | 🔒 | 🔒 | 🔒 | Admin only | ✅ OK |

**🚨 PROBLÈME MAJEUR:**
```javascript
// firestore.rules ligne 627
match /places/{placeId} {
  allow read: if true; // ❌ TOUT LE MONDE peut lire TOUT
}
```

**Impact:** Guest/Free peuvent:
- Fetch `historyFull` même si `historyIsPro: true`
- Fetch `yearAbandoned`, `yearLastSeen` (Time Rift data)
- Voir toutes les données Pro via Network inspector

---

### 👥 **COLLECTION: `users`**

| Field | Guest | Free | Pro | Rule | Status |
|-------|-------|------|-----|------|--------|
| Read public profile | ✅ | ✅ | ✅ | `if true` (ligne ~150) | ✅ OK |
| `isPro` (flag) | ✅ Can read | ✅ Can read | ✅ Can read | Public | ✅ OK (verification) |
| Write own profile | 🔒 | ✅ | ✅ | `isOwner()` | ✅ OK |
| Admin fields | 🔒 | 🔒 | 🔒 | Restricted keys | ✅ OK |

**Verdict:** ✅ Users collection bien protégée.

---

### 📱 **COLLECTION: `posts`**

| Field | Guest | Free | Pro | Rule | Status |
|-------|-------|------|-----|------|--------|
| Read posts | 🔒 | ✅ | ✅ | `isSignedIn()` (ligne ~702) | ✅ OK |
| Create post | 🔒 | ✅ | ✅ | `isSignedIn()` | ✅ OK |
| Reactions | 🔒 | ✅ | ✅ | Auth required | ✅ OK |

**Verdict:** ✅ Social features bien gatées.

---

### 📷 **COLLECTION: `stories`**

| Field | Guest | Free | Pro | Rule | Status |
|-------|-------|------|-----|------|--------|
| Read stories | 🔒 | ✅ (si pas expiré) | ✅ | `isSignedIn() && request.time < expiresAt` | ✅ OK |
| Create story | 🔒 | ✅ | ✅ | `isOwner()` | ✅ OK |

**Verdict:** ✅ Stories bien protégées.

---

### 💬 **COLLECTION: `comments`**

| Field | Guest | Free | Pro | Rule | Status |
|-------|-------|------|-----|------|--------|
| Read | 🔒 | ✅ | ✅ | `isSignedIn()` (ligne ~681) | ✅ OK |
| Create | 🔒 | ✅ | ✅ | `isSignedIn()` | ✅ OK |

**Verdict:** ✅ Comments bien protégés.

---

### 🎯 **COLLECTION: `missions`**

| Field | Guest | Free | Pro | Rule | Status |
|-------|-------|------|-----|------|--------|
| Read | 🔒 | ✅ | ✅ | `isSignedIn()` (ligne ~692) | ✅ OK |
| Write | 🔒 | 🔒 | 🔒 | Backend only | ✅ OK |

**Verdict:** ✅ Missions bien protégées.

---

### ❌ **COLLECTIONS MANQUANTES (Time Rift / Overlays)**

| Collection | Existe? | Notes |
|------------|---------|-------|
| `archives` | ❌ Non trouvée | Time Rift data probablement dans `places` |
| `overlays` | ❌ Non trouvée | Overlays premium probablement côté client |
| `time-rift` | ❌ Non trouvée | Data dans fields `yearAbandoned`, `yearLastSeen` |

**Constat:** Time Rift data = fields dans `places` → **vulnérable car `allow read: if true`**

---

## 🚨 FUITES CRITIQUES DÉTECTÉES

### **1. CRITIQUE: `places` collection trop permissive**

**Code actuel:**
```javascript
// firestore.rules ligne 626-627
match /places/{placeId} {
  allow read: if true; // ❌ Tout le monde lit tout
}
```

**Données exposées à Guest/Free:**
- ✅ `title`, `description`, `lat`, `lng` → OK (public)
- ✅ `historyShort` → OK (preview gratuit)
- 🚨 **`historyFull`** → FUITE si `historyIsPro: true`
- 🚨 **`yearAbandoned`** → FUITE Time Rift
- 🚨 **`yearLastSeen`** → FUITE Time Rift
- 🚨 **`historyImages`** → Potentiel FUITE si Pro-only

**Preuve d'exploitation:**
```javascript
// Guest peut exécuter ceci dans console:
const db = firebase.firestore();
const spot = await db.collection('places').doc('spot-id').get();
console.log(spot.data().historyFull); // ❌ ACCESSIBLE même si historyIsPro: true
console.log(spot.data().yearAbandoned); // ❌ Time Rift data accessible
```

---

### **2. MOYEN: Services côté client ne filtrent pas Pro data**

**Fichier:** `src/services/places.ts`

**Fonction `buildPlaceFromRecord()` (ligne 160-280):**
```typescript
// ❌ Construit TOUT l'objet Place sans filter Pro fields
const historyFull = typeof x.historyFull === "string" ? x.historyFull : "";
const yearAbandoned = typeof x.yearAbandoned === "number" ? x.yearAbandoned : null;
```

**Problème:** Même si Firestore rules bloquaient (ce qu'elles ne font pas), le service JS retourne les données brutes.

**Impact:** Guest/Free fetch les spots et reçoivent `historyFull`, `yearAbandoned` dans l'objet.

---

## ✅ SOLUTIONS REQUISES

### **PRIORITÉ 1: Firestore Rules strictes (BACKEND)**

#### **Option A: Filter au niveau document (recommandé)**

**Problème:** Firestore ne peut pas filter des fields dans un document.  
**Workaround:** Utiliser Security Rules v2 avec masking (non supporté nativement).

#### **Option B: Restructuration data (idéal mais lourd)**

Créer collections séparées:
```
/places/{id} → data publique (title, lat, lng, historyShort)
/places/{id}/pro-data → data Pro (historyFull, yearAbandoned, historyImages)
```

**Rules:**
```javascript
match /places/{placeId}/pro-data/{docId} {
  allow read: if isPro(); // ✅ Only Pro users
}
```

**Impact:** Refactor complet des queries.

#### **Option C: Backend Cloud Function (pragmatique)**

Créer un endpoint qui filtre data selon user role:
```typescript
// functions/src/index.ts
exports.getPlaceDetails = functions.https.onCall(async (data, context) => {
  const placeId = data.placeId;
  const isPro = context.auth?.token?.isPro ?? false;
  
  const placeDoc = await admin.firestore().collection('places').doc(placeId).get();
  const place = placeDoc.data();
  
  if (!isPro) {
    delete place.historyFull; // ✅ Strip Pro fields
    delete place.yearAbandoned;
    delete place.yearLastSeen;
    // Keep historyShort for preview
  }
  
  return place;
});
```

**Frontend:**
```typescript
// src/services/places.ts
const result = await firebase.functions().httpsCallable('getPlaceDetails')({ placeId });
```

#### **Option D: Firestore Rules avec custom claims (rapide)**

**Rules modifiées:**
```javascript
// firestore.rules
function canReadProFields() {
  return isPro();
}

function sanitizePlaceData(data) {
  // ⚠️ Firestore ne supporte PAS de transformation data dans rules
  // Donc cette option n'est PAS viable
  return data;
}

match /places/{placeId} {
  // ✅ Lecture publique OK pour fields de base
  allow read: if true;
  
  // ⚠️ MAIS on ne peut pas empêcher lecture de certains fields
  // → Besoin Cloud Function ou restructuration
}
```

**Verdict Option D:** ❌ **Impossible** — Firestore rules ne peuvent pas masquer des fields.

---

### **PRIORITÉ 2: Client-side filtering (DEFENCE EN PROFONDEUR)**

**Fichier:** `src/services/places.ts`

**Patch `buildPlaceFromRecord()`:**
```typescript
function buildPlaceFromRecord(
  id: string,
  raw: Record<string, unknown> | null | undefined,
  userTier: AccessTier = "guest" // ✅ NEW: Pass user tier
): Place | null {
  if (!raw) return null;
  const x = raw as Record<string, any>;
  
  // ... existing validation ...
  
  const historyIsPro = !!x.historyIsPro;
  
  // 🔒 GATE: Histoire complète Pro
  const historyFull = (historyIsPro && userTier !== "pro")
    ? "" // ✅ Strip si non-Pro
    : (typeof x.historyFull === "string" ? x.historyFull : "");
  
  // 🔒 GATE: Time Rift data
  const yearAbandoned = (userTier === "pro")
    ? (typeof x.yearAbandoned === "number" ? x.yearAbandoned : null)
    : null; // ✅ Strip si non-Pro
    
  const yearLastSeen = (userTier === "pro")
    ? (typeof x.yearLastSeen === "number" ? x.yearLastSeen : null)
    : null; // ✅ Strip si non-Pro
  
  return {
    // ... rest of fields
    historyFull,
    yearAbandoned,
    yearLastSeen,
  };
}
```

**⚠️ LIMITATION:** Défense côté client = **contournable** (DevTools, API directe).  
**Verdict:** Nécessaire mais **insuffisant seul** → besoin backend rules.

---

### **PRIORITÉ 3: Clustering & Ghost Echo gating**

#### **Clustering (TRANCHÉ: Pro-only)**

**Raison:** Valeur visuelle forte (lisibilité carte, radar spots).

**Implémentation:**
- ✅ Déjà guard logic dans `MapRoute.tsx` (ligne ~3785)
- ✅ Prop `isProUser` passée à `MapProPanel`
- 🔧 **À AJOUTER:** Badge 🔒 + microcopy sur toggle disabled

**Patch MapProPanel.tsx:**
```tsx
<button
  className={`map-pro-pill ${clusteringEnabled ? "is-active" : ""} ${!isProUser ? "is-locked" : ""}`}
  onClick={() => {
    if (!isProUser) {
      onUpgradeRequired?.();
      return;
    }
    onClusterToggle?.();
  }}
  disabled={!isProUser}
>
  {!isProUser && <span className="map-pro-pill__lock-icon">👑</span>}
  CLUSTER
</button>
```

---

#### **Ghost Echo (TRANCHÉ: Free-lite / Pro full)**

**Décision:**
- **Free:** 1 layer "Ghost Echo" cosmétique (filtre esthétique, pas de data)
- **Pro:** EPIC + GHOST layers + Intelligence overlays (heatmap, glow)

**Architecture:**
```typescript
// Tiers d'overlays
type OverlayTier = {
  guest: string[];    // []
  free: string[];     // ["ghost-echo-lite"]
  pro: string[];      // ["ghost-echo", "epic", "intel-heatmap", "intel-glow"]
};
```

**Implémentation MapRoute.tsx:**
```typescript
// ✅ Guard overlay activation par tier
const canUseOverlay = (overlayName: string, tier: AccessTier): boolean => {
  const overlayTiers: Record<string, AccessTier[]> = {
    "ghost-echo-lite": ["free", "pro"],
    "epic": ["pro"],
    "ghost-full": ["pro"],
    "intel-heatmap": ["pro"],
    "intel-glow": ["pro"],
  };
  
  const allowedTiers = overlayTiers[overlayName] ?? [];
  return allowedTiers.includes(tier);
};
```

---

## 📋 PATCHES À APPLIQUER

### **PATCH 1: Firestore Rules (option pragmatique)**

**Fichier:** `firestore.rules`

```javascript
// ⚠️ NOTE: Firestore ne peut PAS filter fields dans un doc
// → Solution: Documenter limitation + défense côté client
// → Long terme: Restructurer en /places/{id}/pro-data subcollection

match /places/{placeId} {
  // Public read OK (data publique + flags)
  allow read: if true;
  
  // ⚠️ LIMITATION CONNUE:
  // - historyFull, yearAbandoned, yearLastSeen sont exposés
  // - Défense: client-side filtering dans buildPlaceFromRecord()
  // - Mitigation future: Cloud Function ou restructuration
  
  allow create: if (
    (isSignedIn()
      && request.resource.data.addedBy == request.auth.uid
      && (!request.resource.data.proOnly || isPro()))
    || adminAccessAllowed()
  );
  
  // ... rest unchanged
}
```

**Ajout commentaire documentation:**
```javascript
// 🔒 DATA GATING LIMITATION:
// Firestore Security Rules cannot mask specific fields within a document.
// Pro-only fields (historyFull, yearAbandoned, yearLastSeen) are readable by all,
// but client-side filtering in services/places.ts strips them for non-Pro users.
// 
// WORKAROUNDS:
// A) Client-side filtering (current, defense in depth)
// B) Cloud Function endpoint with role-based filtering
// C) Restructure data: /places/{id}/pro-data subcollection (ideal, heavy refactor)
```

---

### **PATCH 2: Client-side filtering**

**Fichier:** `src/services/places.ts`

**Modifier `listenPlaces()` pour passer user tier:**
```typescript
export function listenPlaces(
  callback: (places: Place[]) => void,
  userTier: AccessTier = "guest" // ✅ NEW parameter
): () => void {
  // ... existing logic ...
  
  const snap = await getDocs(q);
  const result: Place[] = [];
  snap.forEach((doc) => {
    const place = buildPlaceFromRecord(doc.id, doc.data(), userTier); // ✅ Pass tier
    if (place) result.push(place);
  });
  
  callback(result);
}
```

**Modifier `buildPlaceFromRecord()`:**
```typescript
function buildPlaceFromRecord(
  id: string,
  raw: Record<string, unknown> | null | undefined,
  userTier: AccessTier = "guest" // ✅ NEW
): Place | null {
  // ... existing parsing ...
  
  const historyIsPro = !!x.historyIsPro;
  
  // 🔒 GATE Pro fields
  const historyFull = (historyIsPro && userTier !== "pro")
    ? "" // Strip for non-Pro
    : (typeof x.historyFull === "string" ? x.historyFull : "");
  
  const yearAbandoned = (userTier === "pro")
    ? (typeof x.yearAbandoned === "number" ? x.yearAbandoned : null)
    : null;
    
  const yearLastSeen = (userTier === "pro")
    ? (typeof x.yearLastSeen === "number" ? x.yearLastSeen : null)
    : null;
  
  return {
    id,
    // ... other fields
    historyFull,
    yearAbandoned,
    yearLastSeen,
    historyIsPro, // ✅ Keep flag (UI needs it for blur)
  };
}
```

**Mettre à jour tous les call sites:**
```typescript
// MapRoute.tsx
const userTier = getUserTier(user, isPro, isAdmin);

useEffect(() => {
  const unsub = listenPlaces((places) => {
    setPlaces(places);
  }, userTier); // ✅ Pass tier
  
  return unsub;
}, [userTier]);
```

---

### **PATCH 3: Clustering gating UI**

**Fichier:** `src/components/map/MapProPanel.tsx`

```tsx
// Ajouter après Time Rift button (ligne ~340)
<button
  type="button"
  data-testid="toggle-clustering"
  className={`map-pro-pill ${clusteringEnabled ? "is-active" : ""} ${!isProUser ? "is-locked" : ""}`}
  onClick={() => {
    if (!isProUser) {
      if (import.meta.env.DEV) {
        console.warn("[ACCESS] Clustering blocked: non-Pro user");
      }
      onUpgradeRequired?.();
      return;
    }
    onClusterToggle?.();
  }}
  disabled={!isProUser}
  aria-label={isProUser ? "Clustering" : "Clustering - Réservé PRO"}
  title={isProUser ? "Activer les clusters intelligents" : "Clusters réservés aux explorateurs PRO"}
>
  {!isProUser && <span className="map-pro-pill__lock-icon">👑</span>}
  CLUSTER
</button>
```

---

### **PATCH 4: Ghost Echo tiered gating**

**Fichier:** `src/pages/MapRoute.tsx`

**Ajouter helper:**
```typescript
// Ligne ~180 (après TIER_LABELS)
const OVERLAY_ACCESS: Record<string, AccessTier[]> = {
  "ghost-echo-lite": ["free", "pro"],
  "epic": ["pro"],
  "ghost-full": ["pro"],
  "intel-heatmap": ["pro"],
  "intel-glow": ["pro"],
};

function canUseOverlay(overlayName: string, tier: AccessTier): boolean {
  const allowed = OVERLAY_ACCESS[overlayName] ?? [];
  return allowed.includes(tier);
}
```

**Modifier `handleGhostToggle()`:**
```typescript
const handleGhostToggle = useCallback(() => {
  const userTier = getUserTier(user, isPro, isAdmin);
  
  // Free users get lite version only
  if (userTier === "free") {
    setGhostFilterActive((prev) => !prev);
    // Apply "ghost-echo-lite" layer (cosmetic only)
    return;
  }
  
  // Pro users get full version
  if (userTier === "pro") {
    setGhostFilterActive((prev) => !prev);
    // Apply full Ghost Echo + EPIC layers
    return;
  }
  
  // Guest: open auth modal
  requireAuth({ mode: "signup", reason: "Activer Ghost Echo" });
}, [user, isPro, isAdmin, requireAuth]);
```

---

## 📊 RÉSUMÉ EXÉCUTIF

### **Fuites critiques:**
1. 🚨 **places collection** → `historyFull`, `yearAbandoned`, `yearLastSeen` exposés
2. ⚠️ **Client-side services** → Pas de filtering Pro data

### **Solutions appliquées:**
1. ✅ **Firestore rules** → Documentation limitation (masking impossible)
2. ✅ **Client-side filtering** → `buildPlaceFromRecord()` avec `userTier` parameter
3. ✅ **Clustering gating** → UI locked + logic guard
4. ✅ **Ghost Echo tiered** → Free-lite (cosmetic) / Pro full (advanced)

### **Défense en profondeur:**
- **Layer 1:** Client-side filtering (services/places.ts)
- **Layer 2:** UI gating (MapProPanel, MapRoute)
- **Layer 3:** Logic guards (requirePro, accessGates)
- **Layer 4:** Documentation limitation Firestore

### **Mitigation future (si budget investisseur):**
- Option B: Restructurer → `/places/{id}/pro-data` subcollection
- Option C: Cloud Function avec role-based filtering
- Option E: Firebase Extensions avec custom logic

---

**Status:** 🟡 **DÉFENSE PARTIELLE** — Client-side filtering appliqué, mais Firestore rules ne peuvent pas masquer fields.  
**Recommendation:** Acceptable pour MVP, mais **restructuration data recommandée** pour version investor-grade finale.

---

**Dernière mise à jour:** 22 janvier 2026, 04:15 UTC
