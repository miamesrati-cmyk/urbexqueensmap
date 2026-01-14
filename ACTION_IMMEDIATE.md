# 🚨 Actions Immédiates - Audit UrbexQueens Map

## 🔴 CRITIQUE - À faire MAINTENANT (< 24h)

### 1. Réactiver App Check
**Fichier:** `src/lib/firebase.ts` ligne 54

**Problème:** Protection anti-bot désactivée
```typescript
// ACTUELLEMENT:
console.info("[Firebase] AppCheck temporairement désactivé pour le dev");
```

**Solution:**
```typescript
// 1. Firebase Console → App Check → Apps → Manage debug tokens
// 2. Ajouter le token: be270a1f-35b0-489c-b7a0-9eadd116c952

// 3. Décommenter le code:
if (shouldInitializeAppCheck) {
  const provider = appCheckSiteKey
    ? new ReCaptchaV3Provider(appCheckSiteKey)
    : new CustomProvider({
        async getToken() {
          throw new Error("...");
        },
      });

  appCheckInstance = initializeAppCheck(app, {
    provider,
    isTokenAutoRefreshEnabled: true,
  });
}
```

**Test:**
- ✅ Vérifier en dev avec debug token
- ✅ Tester un appel Firestore
- ✅ Vérifier la console (pas d'erreur App Check)

---

### 2. Créer logger wrapper pour production
**Fichier:** `src/utils/logger.ts` (nouveau)

**Problème:** 85+ console.log en production

**Solution:**
```typescript
// src/utils/logger.ts
type LogLevel = 'dev' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = import.meta.env.DEV;
  
  dev(...args: any[]) {
    if (this.isDev) {
      console.log(...args);
    }
  }
  
  info(...args: any[]) {
    console.info(...args);
  }
  
  warn(...args: any[]) {
    console.warn(...args);
  }
  
  error(message: string, error?: unknown) {
    console.error(message, error);
    // TODO: Envoyer à Sentry en production
    if (!this.isDev && typeof window !== 'undefined') {
      // Sentry.captureException(error);
    }
  }
}

export const logger = new Logger();
```

**Remplacements prioritaires:**
```typescript
// MapRoute.tsx - Remplacer:
console.log("📍 ROUTE planner activé...") 
// Par:
logger.dev("📍 ROUTE planner activé...")

// Garder:
console.error(...) // Utile pour Sentry
```

---

### 3. Nettoyer console.logs de MapRoute.tsx
**Fichier:** `src/pages/MapRoute.tsx`

**Problème:** 20+ console.log dans un seul fichier

**Lignes à modifier:**
- 256, 258, 264, 266, 272, 274, 280: Mode toggles
- 1014, 1023, 1030, 1033: Map clicks
- 1122, 1126, 1188: Pointer events
- 1208, 1227, 1239: Toggle done
- 1271, 1281, 1291: Toggle saved

**Script de remplacement rapide:**
```bash
# Dans le terminal:
cd /Users/minaqueen/urbex-canada/urbex-map

# Remplacer console.log par logger.dev dans MapRoute.tsx
sed -i.bak 's/console\.log(/logger.dev(/g' src/pages/MapRoute.tsx

# Ajouter l'import en haut du fichier
# (faire manuellement après le sed)
```

---

## 🟡 HAUTE PRIORITÉ - Cette semaine

### 4. Implémenter admin dynamique
**Fichiers:** `firestore.rules`, `src/services/admin.ts` (nouveau)

**Problème:** Admin UID hardcodé vulnérable

**Solution étape par étape:**

**Étape 1:** Créer collection admins
```typescript
// Firebase Console → Firestore → Créer collection "admins"
// Document ID: AQqXqFOgu4aCRSDUAS8wwUZcJB53
{
  uid: "AQqXqFOgu4aCRSDUAS8wwUZcJB53",
  email: "ton-email@example.com",
  enabled: true,
  role: "superadmin",
  createdAt: serverTimestamp(),
  permissions: {
    approveSpots: true,
    manageUsers: true,
    manageProducts: true,
    viewAnalytics: true
  }
}
```

**Étape 2:** Modifier firestore.rules
```
// Ligne 40-48: Remplacer
function isAdmin() {
  return isSignedIn() && request.auth.uid == adminUid();
}

// Par:
function isAdmin() {
  return isSignedIn() && (
    request.auth.uid == adminUid() || 
    hasEnabledAdmin(request.auth.uid)
  );
}

// Ajouter règles pour collection admins:
match /admins/{adminId} {
  allow read: if isAdmin();
  allow write: if false; // Seulement via Firebase Console
}
```

**Étape 3:** Créer service admin
```typescript
// src/services/admin.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function checkAdminStatus(uid: string): Promise<boolean> {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    return adminDoc.exists() && adminDoc.data()?.enabled === true;
  } catch {
    return false;
  }
}
```

**Étape 4:** Déployer les règles
```bash
firebase deploy --only firestore:rules --force
```

---

### 5. Ajouter CSP Headers
**Fichier:** `firebase.json`

**Problème:** Pas de Content-Security-Policy

**Solution:**
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googleapis.com https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.stripe.com; frame-src https://js.stripe.com; worker-src 'self' blob:;"
          },
          {
            "key": "X-Frame-Options",
            "value": "SAMEORIGIN"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(self), microphone=(), camera=()"
          }
        ]
      }
    ]
  }
}
```

---

### 6. Optimiser images
**Fichiers:** Tous les composants avec `<img>`

**Problème:** Pas de lazy loading natif

**Solution rapide:**
```typescript
// Composant UQImage - Ajouter loading prop
// src/components/UQImage.tsx
<img 
  src={src} 
  alt={alt}
  loading="lazy"  // ← Ajouter ceci
  decoding="async"
/>
```

**Remplacements prioritaires:**
- `src/components/SocialFeed.tsx`
- `src/pages/MapRoute.tsx` (popup images)
- `src/components/ProfilePage.tsx` (avatar, banner)
- `src/pages/ShopPage.tsx` (product images)

---

### 7. Résoudre TODO Printful
**Fichier:** `src/pages/AdminDashboard.tsx` ligne 2335

**Problème:**
```tsx
<span className="admin-pill pill-muted">TODO : sync Printful orders here</span>
```

**Options:**

**Option A: Implémenter la sync**
```typescript
// Créer src/services/printfulOrders.ts
export async function syncPrintfulOrders() {
  const response = await fetch('/api/printful-orders');
  return response.json();
}

// Dans AdminDashboard:
const [printfulOrders, setPrintfulOrders] = useState([]);
useEffect(() => {
  if (page === 'orders') {
    syncPrintfulOrders().then(setPrintfulOrders);
  }
}, [page]);
```

**Option B: Retirer temporairement**
```tsx
// Remplacer par:
<span className="admin-pill pill-muted">
  Commandes Printful disponibles prochainement
</span>
```

---

## 🟢 MOYENNE PRIORITÉ - Ce mois

### 8. Écrire tests critiques

**Test 1: Places service**
```typescript
// src/services/places.test.ts
import { describe, it, expect } from 'vitest';
import { filterPlacesByUserLevel } from './places';

describe('filterPlacesByUserLevel', () => {
  it('should filter ghost places for free users', () => {
    const places = [
      { id: '1', isGhost: true },
      { id: '2', isGhost: false }
    ];
    const result = filterPlacesByUserLevel(places, 'FREE', null);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});
```

**Test 2: Firestore rules**
```typescript
// tests/firestore/places.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe('Places rules', () => {
  it('should allow authenticated users to read public places', async () => {
    const db = /* setup test db */;
    await assertSucceeds(
      db.collection('places').where('isPublic', '==', true).get()
    );
  });
});
```

---

### 9. Configurer Lighthouse CI

**Fichier:** `.github/workflows/lighthouse.yml` (nouveau)

```yaml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:5000
            http://localhost:5000/map
            http://localhost:5000/feed
          uploadArtifacts: true
```

---

## 📋 Checklist de déploiement

Avant de déployer en production, vérifier:

- [ ] App Check réactivé et testé
- [ ] Logger wrapper créé et utilisé dans MapRoute.tsx
- [ ] Aucun console.log non-protégé dans les 10 fichiers principaux
- [ ] Admin dynamique implémenté OU hardcoded admin documenté
- [ ] CSP headers ajoutés dans firebase.json
- [ ] Images ont loading="lazy"
- [ ] TODO Printful résolu (implémenté OU caché)
- [ ] `npm run build` réussit sans erreurs
- [ ] `npm run lint` réussit sans erreurs critiques
- [ ] Tests unitaires écrits pour services critiques
- [ ] Firestore rules déployées: `firebase deploy --only firestore:rules`
- [ ] .env.production vérifié (pas de secrets exposés)
- [ ] Sentry configuré pour capturer les erreurs
- [ ] Lighthouse score > 80 sur toutes les pages

---

## 🆘 En cas de problème

### Chrome crash après déploiement
**Cause probable:** Animations CSS lourdes réactivées

**Solution rapide:**
```css
/* Dans src/styles/profile-gaming.css */
/* Désactiver toutes les animations: */
* {
  animation: none !important;
  transition: none !important;
}
```

### Firestore "INTERNAL ASSERTION FAILED"
**Solution:**
```javascript
// Dans la console navigateur:
await window.__firestoreDebug.clearAndReload()
```

### Build fail
**Vérifier:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

**Temps estimé pour tout implémenter:** 4-6 heures
**Priorité absolue:** Points 1-3 (App Check + Logger + Console.logs cleanup)
