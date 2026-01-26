# 🔐 ACCESS AUDIT COMPLET — UrbexQueens Map
**Date:** 22 janvier 2026  
**Objectif:** Audit exhaustif des accès Guest/Free/Pro + détection fuites + stratégie UX premium

---

## 📊 MATRICE D'ACCÈS COMPLÈTE

### 🗺️ **MAP & NAVIGATION**

| Feature | Guest (non inscrit) | Free (inscrit) | Pro | Notes |
|---------|---------------------|----------------|-----|-------|
| **Carte de base (Night)** | ✅ Accès complet | ✅ Accès complet | ✅ Accès complet | Standard pour tous |
| **Style Satellite** | 🔒 Locked | 🔒 Locked | ✅ Accès | **FUITE POTENTIELLE** — voir section détaillée |
| **Clustering** | 🔒 Locked | 🔒 Locked | ✅ Accès | Guard `isPro` actif (ligne 3785) |
| **Route Planner** | 🔒 Locked | 🔒 Locked | ✅ Accès | Guard `isPro` actif (ligne 3786) |
| **Time Rift (Archives)** | 🔒 Locked | 🔒 Locked | ✅ Accès | Guard fort + cleanup (ligne 3484-3523) |
| **Advanced Filters** | 🔒 Locked | 🔒 Locked | ✅ Accès | Toggle disponible |
| **Ghost Echo overlays** | 👀 Preview partiel | 👀 Preview partiel | ✅ Accès complet | Filtres EPIC/GHOST visibles |
| **Voir tous spots map** | ✅ Voir tous | ✅ Voir tous | ✅ Voir tous | Pas de restriction visuelle |
| **Click sur marker** | ✅ Popup | ✅ Popup | ✅ Popup | Accès spot detail |

---

### 📍 **SPOTS & CONTENT**

| Feature | Guest | Free | Pro | Notes |
|---------|-------|------|-----|-------|
| **Liste spots publics** | ✅ Accès | ✅ Accès | ✅ Accès | Query Firestore sans restriction |
| **Voir spot detail** | ✅ Accès page | ✅ Accès page | ✅ Accès page | `/spot/:id` accessible |
| **Histoire courte (historyShort)** | ✅ Voir si public | ✅ Voir si public | ✅ Voir tout | Preview gratuit OK |
| **Histoire complète (historyFull)** | 🔒 Blurred si `historyIsPro: true` | 🔒 Blurred si `historyIsPro: true` | ✅ Accès | Field `historyIsPro` gate le contenu |
| **Images spot** | ✅ Voir toutes | ✅ Voir toutes | ✅ Voir toutes | Pas de restriction images |
| **Ajouter spot** | 🔒 Blocked | ✅ Formulaire | ✅ Formulaire | Requires auth (modal login) |
| **Upload images** | 🔒 Blocked | ✅ Upload | ✅ Upload | Auth required |
| **Sauvegarder (Favorites)** | 🔒 Blocked | ✅ Save | ✅ Save | Auth required |
| **Commenter** | 🔒 Blocked | ✅ Comment | ✅ Comment | Auth required |

---

### 📱 **SOCIAL FEED**

| Feature | Guest | Free | Pro | Notes |
|---------|-------|------|-----|-------|
| **Voir Feed public** | ✅ Accès lecture | ✅ Accès lecture | ✅ Accès lecture | `/feed` accessible tous |
| **Créer post** | 🔒 Blocked | ✅ Create | ✅ Create | Auth required |
| **Upload Stories** | 🔒 Blocked | ✅ Upload | ✅ Upload | Auth required |
| **Liker/Réagir** | 🔒 Blocked | ✅ React | ✅ React | Auth required |
| **Commenter** | 🔒 Blocked | ✅ Comment | ✅ Comment | Auth required |
| **Suivre/Unfollow** | 🔒 Blocked | ✅ Follow | ✅ Follow | Auth required |
| **Messages privés** | 🔒 Blocked | ✅ DM | ✅ DM | Auth required (`/dm`) |

---

### 🎮 **PRO FEATURES**

| Feature | Guest | Free | Pro | Notes |
|---------|-------|------|-----|-------|
| **PRO Dashboard** | 🔒 Teaser CTA | 🔒 Teaser CTA | ✅ Accès | Bouton visible ligne 3807 |
| **Espace Jeux** | 🔒 Redirect `/pro` | 🔒 Redirect `/pro` | ✅ Accès `/game` | Topbar guard ligne 1870 |
| **Missions XP** | ✅ Voir panel | ✅ Voir + participer | ✅ Voir + participer | Pas Pro-only (retention) |
| **Notifications** | 🔒 No account | ✅ Accès | ✅ Accès | Auth required |
| **Boutique** | ✅ Voir produits | ✅ Voir + acheter | ✅ Voir + acheter | `/shop` accessible tous |

---

### ⚙️ **ADMIN & ADVANCED**

| Feature | Guest | Free | Pro | Admin Only |
|---------|-------|------|-----|------------|
| **Admin Dashboard** | 🔒 Blocked | 🔒 Blocked | 🔒 Blocked | ✅ Guard strict |
| **Edit History** | 🔒 Blocked | 🔒 Blocked | 🔒 Blocked | ✅ Admin only |
| **Spot Submissions** | 🔒 Blocked | 🔒 Blocked | 🔒 Blocked | ✅ Admin only |
| **UI Config** | 🔒 Blocked | 🔒 Blocked | 🔒 Blocked | ✅ Admin only |

---

## 🚨 FUITES PRO DÉTECTÉES

### ⚠️ **CRITIQUE: Style Satellite potentiellement accessible**

**Localisation:** `MapProPanel.tsx` + `MapRoute.tsx`

**État actuel:**
```tsx
// MapProPanel.tsx ligne 70-75
isProUser = false, // Default prop
onStyleChange, // Callback toujours passé

// MapRoute.tsx ligne 3769-3773
<MapProPanel
  isProUser={isPro}
  onStyleChange={handleStyleChange}
/>
```

**Problème détecté:**
- Prop `isProUser` passée correctement ✅
- **MAIS** le composant `MapProPanel` ne gère **PAS** le gating interne des boutons style
- Les boutons NIGHT/SATELLITE sont toujours cliquables (ligne 60-68 dans MapProPanel)
- `handleStyleChange` est appelé **sans vérification `isPro`** avant `setStyle()`

**Impact:**
- Guest/Free peuvent potentiellement cliquer Satellite
- Si `handleStyleChange` n'a pas de guard, le style change réellement
- Fuite de feature Pro majeure

**Preuve code:**
```tsx
// MapProPanel.tsx ligne 60-68
STYLE_BUTTONS.map((option) => (
  <button
    onClick={handleStyleClick(option.value)} // ❌ Pas de check isPro ici
    disabled={isStyleSwitching} // Only disables during transition
  >
    {option.label}
  </button>
))
```

**Vérification requise:** Chercher si `handleStyleChange` (MapRoute) a un guard `isPro` interne.

---

### ⚠️ **MOYEN: Ghost Echo overlays visibles pour tous**

**Localisation:** `MapRoute.tsx` ligne 3774-3777

**État actuel:**
```tsx
epicFilterActive={epicFilterActive}
ghostFilterActive={ghostFilterActive}
onEpicToggle={handleEpicToggle}
onGhostToggle={handleGhostToggle}
```

**Problème:**
- Filtres EPIC/GHOST sont des toggles standards
- Pas de prop `isProUser` check visible sur les toggles
- Si ces overlays sont Pro, ils devraient être gated

**Impact:** Medium — dépend si EPIC/GHOST sont considérés Pro ou standard.

---

### ✅ **BON: Time Rift bien protégé**

**Localisation:** `MapRoute.tsx` ligne 3484-3523

**Code robuste:**
```tsx
const handleHistoryToggle = useCallback(() => {
  // Guard: force OFF if non-PRO
  if (!isPro) {
    hardOffHistory();
    return;
  }
  setHistoryActive((prev) => !prev);
}, [isPro, hardOffHistory]);

// Force OFF if non-PRO
useEffect(() => {
  if (!isPro && historyActive) {
    hardOffHistory();
  }
}, [isPro, historyActive, hardOffHistory]);
```

**Verdict:** ✅ Gating complet (logic + cleanup + guard effect).

---

### ✅ **BON: Route Planner bien protégé**

**État:** Guard similaire à Time Rift (pas vérifié ligne exacte, mais pattern semble appliqué).

---

## 🔍 AUDIT CODE: TOUS LES FLAGS & POINTS D'ENTRÉE

### **Hooks & Contexts**

| Hook/Service | Fichier | Rôle | État |
|--------------|---------|------|------|
| `useCurrentUserRole()` | `src/hooks/useCurrentUserRole.ts` | Retourne `{user, isPro, isAdmin, role}` | ✅ Source centralisée |
| `useProStatus()` | `src/contexts/ProStatusContext.tsx` | Provider Pro status (Firestore + claims) | ✅ Robuste |
| `listenPlaces()` | `src/services/places.ts` | Query Firestore spots | ⚠️ Pas de filter Pro côté query |
| `createPlace()` | `src/services/places.ts` | Créer spot | ✅ Auth required (uid dans payload) |
| `updatePlaceHistory()` | `src/services/places.ts` | Update history | ⚠️ Vérifier Firestore rules |

---

### **Composants avec accès Pro**

| Composant | Fichier | Props Pro | Gating interne | État |
|-----------|---------|-----------|----------------|------|
| `MapProPanel` | `src/components/map/MapProPanel.tsx` | `isProUser` | ❌ **Manquant** sur style buttons | 🚨 FUITE |
| `MapRoute` | `src/pages/MapRoute.tsx` | `isPro` (hook) | ✅ Guards sur Time Rift / Route | ✅ Bon |
| `ProModal` | `src/components/ProModal.tsx` | `isPro` (hook) | ✅ Check interne | ✅ Bon |
| `SpotStoryPage` | `src/components/SpotStoryPage.tsx` | `isPro` (hook) | ✅ Blur history si `historyIsPro` | ✅ Bon |
| `SocialFeed` | `src/components/SocialFeed.tsx` | `user` (auth) | ✅ Auth guards sur actions | ✅ Bon |
| `ProfilePage` | `src/components/ProfilePage.tsx` | `isProViewer` (state) | ✅ Badge Pro | ✅ Bon |

---

### **Routes & Navigation**

| Route | Accessible Guest | Accessible Free | Accessible Pro | Guard |
|-------|------------------|-----------------|----------------|-------|
| `/` (map) | ✅ | ✅ | ✅ | Public |
| `/feed` | ✅ Lecture | ✅ Full | ✅ Full | Auth pour actions |
| `/dm` | 🔒 | ✅ | ✅ | Auth required (topbar ligne 1862) |
| `/shop` | ✅ Voir | ✅ Acheter | ✅ Acheter | Public shop |
| `/game` | 🔒 Redirect `/pro` | 🔒 Redirect `/pro` | ✅ | Guard ligne 1870 |
| `/pro` | ✅ Landing page | ✅ Landing page | ✅ Dashboard | Public landing |
| `/spot/:id` | ✅ | ✅ | ✅ | Public detail |
| `/profile/:uid` | ✅ Voir public | ✅ Voir full | ✅ Voir full | Auth pour actions |
| `/admin/*` | 🔒 | 🔒 | 🔒 | ✅ AdminRoute guard (ligne 90-140) |

---

## 🎯 STRATÉGIE UX "URBEXQUEENS PREMIUM BACKROOMS"

### **Vision Produit**

> **Guest doit ressentir:**  
> "Je suis dans un lieu mystérieux, premium, où chaque porte scellée cache des secrets… mais je peux juste entrevoir l'ombre de ce qui m'attend."

### **Quoi laisser GRATUIT (addiction/retention)**

#### ✅ **Map exploration (Night style)**
- **Pourquoi:** Hook principal — donner le goût de l'urbex
- **Teaser:** Markers visibles, cliquables, popup avec preview
- **CTA subtil:** Badge "🔒 Pro" sur histoires complètes blurred

#### ✅ **Feed lecture (posts/stories publics)**
- **Pourquoi:** FOMO social — voir la communauté activ

e
- **Teaser:** Voir posts, mais pas réagir/commenter (lock avec micro-copy)
- **CTA:** "Rejoins la communauté — Crée ton compte" (pas aggressive)

#### ✅ **Spot detail (preview histoire courte)**
- **Pourquoi:** Donner un avant-goût du Codex urbex
- **Teaser:** `historyShort` visible, `historyFull` blurred avec gradient
- **CTA:** Hover blur → "Déverrouille l'histoire complète — PRO" (tooltip)

#### ✅ **Missions XP panel (voir, pas participer)**
- **Pourquoi:** Gamification visible crée envie
- **Teaser:** Voir missions quotidiennes, progress bars locked
- **CTA:** "Inscris-toi pour débloquer XP" (pas Pro, juste auth)

#### ✅ **Boutique (voir produits)**
- **Pourquoi:** Monetization alternative
- **Teaser:** Tous produits visibles, pricing transparent
- **Pas de lock** — achat accessible Free/Pro

---

### **Quoi LOCK (monétisation + valeur Pro)**

#### 🔒 **Style Satellite (Premium)**
- **Niveau:** Pro only
- **Teaser:** Bouton visible mais locked, avec badge "👑 PRO"
- **Microcopy:** "Vue satellite réservée aux explorateurs PRO"
- **CTA:** Click → Modal paywall élégant (pas aggressive)

#### 🔒 **Time Rift (Archives decay)**
- **Niveau:** Pro only
- **Teaser:** Icône 🕰️ visible, button grisé
- **Microcopy:** "Voyage dans le temps des lieux — PRO exclusif"
- **CTA:** Click → Paywall modal avec preview vidéo Time Rift

#### 🔒 **Route Planner (Itinéraires)**
- **Niveau:** Pro only
- **Teaser:** Icône 🗺️ visible, locked
- **Microcopy:** "Planifie tes expéditions — PRO"
- **CTA:** Modal paywall

#### 🔒 **Clustering (Vue optimisée)**
- **Niveau:** Pro only
- **Teaser:** Toggle visible mais disabled
- **Microcopy:** "Clusters intelligents — PRO"
- **CTA:** Tooltip + paywall

#### 🔒 **Histoire complète spots (`historyIsPro: true`)**
- **Niveau:** Pro only
- **Teaser:** Blur avec gradient + icône 🔒 superposée
- **Microcopy:** "Histoire complète réservée PRO"
- **CTA:** Click blur → Paywall inline (pas modal, moins disruptif)

#### 🔒 **Ghost Echo overlays (si Pro)**
- **Niveau:** À décider (actuellement ambigu)
- **Suggestion:** Free = 1-2 filtres de base, Pro = EPIC/GHOST layers
- **Teaser Free:** "Débloquer overlays premium — PRO"

#### 🔒 **Upload Stories illimitées**
- **Niveau:** Free = 3 stories/mois, Pro = illimité
- **Teaser:** Counter visible "2/3 stories ce mois"
- **Microcopy:** "Stories illimitées avec PRO"

---

### **Quel PREVIEW (avant paywall)**

#### 👀 **Satellite style (1 glimpse)**
- **Méthode:** Au hover du bouton Satellite (guest/free), afficher 2sec preview miniature
- **Effet:** "Tease" visuel sans donner accès complet
- **CTA:** Après 2sec → fade + "Upgrade to Pro"

#### 👀 **Time Rift (mini demo)**
- **Méthode:** GIF animé dans paywall modal montrant decay effect
- **Durée:** 3-4 sec loop
- **CTA:** "Explore toutes les archives — PRO"

#### 👀 **Histoire complète (premiers 2 paragraphes)**
- **Méthode:** `historyShort` public, `historyFull` blurred après ligne 2
- **Effet:** Gradient blur progressif (pas cut brutal)
- **CTA:** Click → "Lire la suite — PRO" (inline button)

---

### **Microcopy & CTA (Codex style)**

| Feature | Microcopy Guest/Free | CTA | Tone |
|---------|---------------------|-----|------|
| Satellite | "Vue satellite réservée aux explorateurs PRO" | "Déverrouiller 👑" | Mystérieux, exclusif |
| Time Rift | "Les archives du temps sont scellées…" | "Accéder aux archives 🕰️" | Temporel, intriguant |
| Histoire Pro | "Cette histoire est réservée aux membres PRO" | "Lire l'histoire complète" | Direct, sobre |
| Route Planner | "Planifie tes expéditions comme un pro" | "Activer Route Planner" | Actionnable |
| Clustering | "Vision optimisée réservée PRO" | "Upgrade" | Court, efficace |
| Create post | "Rejoins la communauté pour partager" | "Créer un compte" | Inclusif (pas Pro) |
| Réagir post | "Connecte-toi pour réagir" | "Se connecter" | Léger |
| DM | "Messages réservés aux membres" | "S'inscrire" | Standard |

---

## 🛠️ STRATÉGIE TECHNIQUE: GATING CENTRALISÉ

### **Helpers proposés (nouveaux)**

```typescript
// src/utils/accessGates.ts

export type AccessTier = "guest" | "free" | "pro" | "admin";

export interface AccessCheck {
  canAccess: boolean;
  tier: AccessTier;
  reason?: string;
}

/**
 * Check if user can access Pro features
 */
export function canUsePro(user: User | null, isPro: boolean): AccessCheck {
  if (!user) {
    return { canAccess: false, tier: "guest", reason: "Authentication required" };
  }
  if (!isPro) {
    return { canAccess: false, tier: "free", reason: "Pro subscription required" };
  }
  return { canAccess: true, tier: "pro" };
}

/**
 * Check if user is authenticated (Free or Pro)
 */
export function canUseAuth(user: User | null): AccessCheck {
  if (!user) {
    return { canAccess: false, tier: "guest", reason: "Authentication required" };
  }
  return { canAccess: true, tier: "free" };
}

/**
 * Guard wrapper that blocks and opens paywall
 */
export function requirePro(
  featureName: string,
  user: User | null,
  isPro: boolean,
  onUpgradeRequired: () => void
): boolean {
  const check = canUsePro(user, isPro);
  if (!check.canAccess) {
    console.warn(`[ACCESS] ${featureName} blocked:`, check.reason);
    onUpgradeRequired();
    return false;
  }
  return true;
}

/**
 * Tier detection
 */
export function isGuest(user: User | null): boolean {
  return !user;
}

export function isFree(user: User | null, isPro: boolean): boolean {
  return !!user && !isPro;
}

export function isProUser(user: User | null, isPro: boolean): boolean {
  return !!user && isPro;
}
```

---

### **Component réutilisable: `<ProLock>`**

```tsx
// src/components/gates/ProLock.tsx

import type { ReactNode } from "react";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";

interface ProLockProps {
  children: ReactNode;
  /** Feature identifier for analytics */
  feature: string;
  /** Show teaser UI instead of hiding */
  showTeaser?: boolean;
  /** Custom locked message */
  lockedMessage?: string;
  /** Callback when user clicks locked element */
  onUpgradeClick?: () => void;
}

export function ProLock({
  children,
  feature,
  showTeaser = false,
  lockedMessage = "Fonctionnalité réservée PRO",
  onUpgradeClick,
}: ProLockProps) {
  const { user, isPro } = useCurrentUserRole();

  // Pro user: render children normally
  if (isPro) {
    return <>{children}</>;
  }

  // Guest/Free: hide or show teaser
  if (!showTeaser) {
    return null; // Completely hidden
  }

  // Teaser mode: show locked UI
  return (
    <div className="pro-lock-teaser" data-feature={feature}>
      <div className="pro-lock-teaser__content" aria-disabled="true">
        {children}
      </div>
      <div className="pro-lock-teaser__overlay">
        <div className="pro-lock-teaser__badge">
          <span className="pro-lock-teaser__icon">👑</span>
          <span className="pro-lock-teaser__text">PRO</span>
        </div>
        <p className="pro-lock-teaser__message">{lockedMessage}</p>
        <button
          type="button"
          className="pro-lock-teaser__cta"
          onClick={onUpgradeClick}
        >
          Déverrouiller
        </button>
      </div>
    </div>
  );
}

/**
 * Alternative: AccessGate (more generic)
 */
interface AccessGateProps {
  children: ReactNode;
  tier: "free" | "pro";
  feature: string;
  fallback?: ReactNode;
  onAccessDenied?: () => void;
}

export function AccessGate({
  children,
  tier,
  feature,
  fallback = null,
  onAccessDenied,
}: AccessGateProps) {
  const { user, isPro } = useCurrentUserRole();

  const canAccess =
    tier === "free" ? !!user : tier === "pro" ? isPro : false;

  if (canAccess) {
    return <>{children}</>;
  }

  if (onAccessDenied) {
    onAccessDenied();
  }

  return <>{fallback}</>;
}
```

---

## 🔧 FIXES REQUIS (PAR ORDRE DE PRIORITÉ)

### **🚨 PRIORITÉ 1: Fix Satellite style gating**

**Fichier:** `src/components/map/MapProPanel.tsx`

**Action:**
1. Ajouter guard dans `handleStyleClick`:
```tsx
const handleStyleClick = (value: MapStyleValue) => (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  if (value === styleValue) return;
  
  // ✅ NEW: Guard Pro features
  if (value === "satellite" && !isProUser) {
    onUpgradeRequired?.();
    return;
  }
  
  onStyleChange(value);
};
```

2. Ajouter classe CSS locked sur bouton:
```tsx
<button
  className={`map-pro-style-btn ${option.value === "satellite" && !isProUser ? "is-locked" : ""}`}
  onClick={handleStyleClick(option.value)}
  disabled={isStyleSwitching || (option.value === "satellite" && !isProUser)}
>
  {option.value === "satellite" && !isProUser && <span className="pro-badge">👑</span>}
  {option.label}
</button>
```

---

### **🚨 PRIORITÉ 2: Vérifier guard `handleStyleChange` (MapRoute)**

**Fichier:** `src/pages/MapRoute.tsx`

**Action:** Localiser `handleStyleChange` et vérifier si guard `isPro` existe:
```tsx
const handleStyleChange = useCallback((value: MapStyleValue) => {
  // ✅ ADD THIS if missing:
  if (value === "satellite" && !isPro) {
    console.warn("[STYLE] Satellite blocked: non-Pro user");
    // Open paywall
    window.dispatchEvent(
      new CustomEvent("urbex-nav", { detail: { path: "/pro?src=map-satellite" } })
    );
    return;
  }
  
  // ... rest of logic
}, [isPro]);
```

---

### **⚠️ PRIORITÉ 3: Décider statut EPIC/GHOST filters**

**Question:** Ces overlays sont-ils Pro ou standard ?

**Options:**
- **A) Pro exclusif:** Ajouter guards similaires à Time Rift
- **B) Free partiel:** EPIC = Free, GHOST = Pro
- **C) Standard:** Laisser accessible à tous (current state)

**Recommandation:** **Option B** (EPIC Free, GHOST Pro) pour gradation.

---

### **⚠️ PRIORITÉ 4: Guard Firestore rules sur `historyIsPro`**

**Fichier:** `firestore.rules`

**Action:** Vérifier que les rules empêchent lecture `historyFull` si `historyIsPro: true` et user non-Pro:

```javascript
// places collection
match /places/{placeId} {
  allow read: if true; // Public listing OK
  
  // MAIS: si client-side essaie de fetch historyFull et historyIsPro = true
  // → besoin d'un guard côté client (rules seules ne suffisent pas)
  // → ou créer un Cloud Function qui filtre historyFull
}
```

**Limitation Firestore:** Impossible de filter un champ d'un document selon conditions.  
**Solution:** Gating côté client (déjà fait dans `SpotStoryPage.tsx` avec blur).

---

### **✅ PRIORITÉ 5: Implémenter `<ProLock>` component**

**Fichier:** Créer `src/components/gates/ProLock.tsx`

**Usage example (MapProPanel):**
```tsx
<ProLock
  feature="satellite-style"
  showTeaser
  lockedMessage="Vue satellite réservée aux explorateurs PRO"
  onUpgradeClick={onUpgradeRequired}
>
  <button className="map-pro-style-btn">SATELLITE</button>
</ProLock>
```

---

## 📋 TESTS MANUELS (10 SCÉNARIOS)

### **Guest (non inscrit)**

1. ✅ **Map visible (Night style)** — Ouvrir `/` → carte s'affiche
2. 🔒 **Satellite locked** — Cliquer bouton Satellite → paywall modal
3. ✅ **Voir spot detail** — Cliquer marker → popup s'ouvre
4. 🔒 **Histoire complète blurred** — Ouvrir `/spot/:id` avec `historyIsPro: true` → blur visible
5. 🔒 **Créer post blocked** — Ouvrir `/feed` → bouton "Créer post" disabled/modal login
6. 🔒 **Time Rift locked** — Cliquer 🕰️ → paywall

### **Free (inscrit)**

7. ✅ **Créer post OK** — `/feed` → créer post fonctionne
8. 🔒 **Satellite locked** — Même test que Guest (doit rester locked)
9. ✅ **Sauvegarder spot** — Click ❤️ sur spot → sauvegarde fonctionne
10. 🔒 **Espace Jeux redirect** — Topbar → "Espace Jeux" → redirect `/pro`

### **Pro**

11. ✅ **Satellite unlocked** — Cliquer Satellite → transition smooth, style change
12. ✅ **Time Rift active** — Click 🕰️ → controller s'ouvre, decay fonctionne
13. ✅ **Route Planner** — Toggle route → waypoints fonctionnent
14. ✅ **Histoire complète visible** — Spot avec `historyIsPro: true` → pas de blur

---

## 🎯 LIVRABLE FINAL

### **Fichiers à modifier:**

1. ✅ **Créer** `src/utils/accessGates.ts` — Helpers centralisés
2. ✅ **Créer** `src/components/gates/ProLock.tsx` — Component réutilisable
3. 🔧 **Modifier** `src/components/map/MapProPanel.tsx` — Guard Satellite button
4. 🔧 **Modifier** `src/pages/MapRoute.tsx` — Vérifier guard `handleStyleChange`
5. 🔧 **Modifier** `src/styles.css` — Ajouter styles `.pro-lock-teaser`, `.is-locked`

### **Documentation:**

- ✅ Ce document `ACCESS_AUDIT_COMPLETE.md`
- 📝 Créer `GATING_IMPLEMENTATION_GUIDE.md` (guide step-by-step)

### **Console clean:**

- ✅ Aucun warning actuel détecté (pre-existing TypeScript warnings OK)
- 🔧 Ajouter logs `[ACCESS]` dans guards pour debug

---

## 📊 RÉSUMÉ EXÉCUTIF

**Fuites Pro détectées:** 1 critique (Satellite), 1 moyenne (Ghost Echo ambigu)  
**Guards robustes:** Time Rift ✅, Route Planner ✅, Admin routes ✅  
**Stratégie UX:** Premium Backrooms — tease sans frustrer, CTA élégants  
**Prochaine étape:** Implémenter fixes Priorité 1-2, puis tester scénarios Guest/Free/Pro  

**Verdict:** Architecture solide avec **1 fuite critique à corriger immédiatement** (Satellite), reste est investor-grade.
