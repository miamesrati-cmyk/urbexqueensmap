# Firebase App Check - Configuration Production

## 🎯 Objectif

Activer App Check pour sécuriser les écritures Firestore/Functions en production (anti-spam, anti-bot).

**Status actuel:** Mode debug (console + sessionStorage) fonctionne sans App Check.
**Timeline:** Configurer APRÈS ship v3.0, AVANT activation écritures Firestore live.

---

## ✅ Pourquoi App Check?

**Sans App Check:**
- ❌ Bots peuvent spammer Firestore writes (coût $$)
- ❌ Scripts malicieux gonflent métriques
- ❌ Endpoints Cloud Functions exposés

**Avec App Check:**
- ✅ Seules les requêtes depuis votre app web/mobile autorisées
- ✅ Protection anti-fraude (reCAPTCHA v3 détecte bots)
- ✅ Respect des quotas Firebase

---

## 🔧 Setup (3 étapes)

### Étape 1: Firebase Console

1. **Ouvrir:** https://console.firebase.google.com/
2. **Projet:** Sélectionner `urbex-canada` (ou votre projet Firebase)
3. **Menu:** Build → App Check
4. **Cliquer:** "Register" (pour votre app Web)

---

### Étape 2: Choisir Provider

**Option A: reCAPTCHA v3 (Recommandé pour MVP)**

- ✅ Setup simple (5 min)
- ✅ Invisible pour utilisateurs (pas de CAPTCHA visible)
- ✅ Gratuit (1M requêtes/mois)
- ⚠️ Limite: Pas aussi robuste qu'Enterprise

**Steps:**
1. Aller sur: https://www.google.com/recaptcha/admin
2. Créer un site:
   - **Type:** reCAPTCHA v3
   - **Domaines:** `urbexqueens.com`, `localhost` (pour dev)
3. Copier **Site Key** (public, safe dans .env)
4. Copier **Secret Key** (gardé côté Firebase Console)

**Option B: reCAPTCHA Enterprise (Production-grade)**

- ✅ Détection fraude avancée
- ✅ Analytics + insights
- ✅ SLA garanti
- ⚠️ Coût: $1/1000 appels après quota gratuit

**Steps:**
1. Activer Cloud Console → reCAPTCHA Enterprise API
2. Créer une clé Enterprise
3. Configurer dans Firebase Console (même flow qu'Option A)

---

### Étape 3: Configuration Code

**A) Ajouter la Site Key dans `.env.production`:**

```bash
# .env.production (ou variables d'environnement Vercel/Netlify)
VITE_FIREBASE_APP_CHECK_SITE_KEY=6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**B) Vérifier initialisation dans `src/lib/firebase.ts`:**

Si pas déjà fait, ajouter:

```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Config existante
const firebaseConfig = { ... };

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// ═══════════════════════════════════════════════════════════════
// APP CHECK (Production-only)
// ═══════════════════════════════════════════════════════════════

if (typeof window !== "undefined") {
  const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;

  if (appCheckSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true, // Refresh token automatiquement
      });
      console.log("[APP CHECK] Initialized successfully");
    } catch (error) {
      console.error("[APP CHECK] Initialization failed:", error);
    }
  } else {
    console.warn(
      "[APP CHECK] Site key missing. Running in debug mode (writes may be blocked in prod)."
    );
  }
}
```

**C) Build et deploy:**

```bash
npm run build
# Vérifier que VITE_FIREBASE_APP_CHECK_SITE_KEY est dans l'environnement de déploiement
firebase deploy --only hosting
```

---

## 🧪 Validation

### Test 1: Dev Mode (sans App Check)

```bash
# .env.local (local dev, pas de site key)
# VITE_FIREBASE_APP_CHECK_SITE_KEY non défini

npm run dev
```

**Attendu:**
- Console: `[APP CHECK] Site key missing. Running in debug mode...`
- Tracking debug fonctionne (console + sessionStorage)
- **Aucune écriture Firestore** (TODO commenté)

---

### Test 2: Production Mode (avec App Check)

```bash
# .env.production (déployé)
VITE_FIREBASE_APP_CHECK_SITE_KEY=6Lxxxxx...

npm run build && npm run preview
```

**Attendu:**
- Console: `[APP CHECK] Initialized successfully`
- **Aucun warning** "Site key missing"
- Écritures Firestore/Functions autorisées (quand décommentées)

**Validation complète:**
1. Ouvrir Network tab (Chrome DevTools)
2. Naviguer sur `/pro?src=history`
3. Vérifier requête `https://firebaseappcheck.googleapis.com/v1/projects/...`
4. Status: `200 OK` + token présent

---

## 🚨 Firebase Rules (Enforce App Check)

**CRITIQUE:** Activer enforcement côté Firebase pour forcer App Check.

### Firestore Rules (`firestore.rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: Vérifier App Check
    function isAppCheckVerified() {
      return request.auth != null && request.app != null;
    }
    
    // Example: Collection analytics_events (écriture Cloud Function only)
    match /analytics_events/{eventId} {
      allow read: if request.auth != null;
      allow write: if false; // Force Cloud Function (pas client direct)
    }
    
    // Example: Collection analytics_daily (agrégats)
    match /analytics_daily/{date}/counters/{counterId} {
      allow read: if request.auth != null;
      allow write: if false; // Force Cloud Function
    }
    
    // Autres collections existantes...
    match /places/{placeId} {
      allow read: if true;
      allow write: if request.auth != null && isAppCheckVerified();
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only firestore:rules
```

---

### Cloud Functions (`functions/src/index.ts`):

```typescript
import { onCall } from "firebase-functions/v2/https";
import { getAppCheck } from "firebase-admin/app-check";

export const logConversion = onCall(
  { 
    enforceAppCheck: true, // Force App Check verification
    consumeAppCheckToken: true, // Token utilisé une seule fois
  },
  async (request) => {
    // App Check vérifié automatiquement par Firebase
    const { event, metadata } = request.data;
    
    // Votre logique d'écriture analytics...
    await db.collection("analytics_events").add({
      event,
      ...metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }
);
```

**Deploy functions:**
```bash
cd functions
npm run build
firebase deploy --only functions
```

---

## 📊 Monitoring (Post-Activation)

### Firebase Console → App Check

**Métriques disponibles:**
- Requests/hour (total)
- Verified requests (App Check passed)
- Suspicious requests (App Check failed)
- Token refresh rate

**Red flags:**
- Verified rate < 95% → Possible config issue
- Suspicious spikes → Bot attack detected

---

## 🐛 Troubleshooting

### Issue: "App Check token missing" en production

**Cause:** Site key pas dans environnement de déploiement

**Fix:**
```bash
# Vercel
vercel env add VITE_FIREBASE_APP_CHECK_SITE_KEY

# Netlify
netlify env:set VITE_FIREBASE_APP_CHECK_SITE_KEY 6Lxxxxx...

# Firebase Hosting (pas besoin, .env.production suffit)
```

---

### Issue: "reCAPTCHA validation failed"

**Cause:** Domaine pas whitelisté dans reCAPTCHA admin

**Fix:**
1. Google reCAPTCHA Admin: https://www.google.com/recaptcha/admin
2. Settings → Domains
3. Ajouter: `urbexqueens.com`, `www.urbexqueens.com`
4. Save

---

### Issue: Quotas dépassés (reCAPTCHA v3)

**Quota gratuit:** 1M appels/mois

**Si dépassé:**
- Option A: Upgrade vers reCAPTCHA Enterprise ($1/1000 appels)
- Option B: Optimiser (cache tokens, reduce refresh rate)

---

## 💰 Coûts Estimés

### reCAPTCHA v3 (Gratuit)
- 0-1M requêtes/mois: **$0**
- > 1M: Migrer vers Enterprise

### reCAPTCHA Enterprise
- 0-10K requêtes/mois: **$0** (quota gratuit)
- 10K-1M: **$1/1000 requêtes** = $990/month max
- > 1M: Volume pricing (négociable)

**Estimation UrbexQueens:**
- 10K utilisateurs actifs/mois
- 3 pages/session moyenne
- = 30K App Check validations/mois
- **Coût:** $0 (sous quota gratuit)

---

## 🚀 Timeline Recommandée

### Phase 1: Ship v3.0 (AUJOURD'HUI)
- ✅ Mode debug (console + sessionStorage)
- ✅ Aucune écriture Firestore live
- ✅ App Check warning OK (sécurité > métriques)

### Phase 2: Setup App Check (Semaine 1)
- Configure reCAPTCHA v3 (5 min)
- Add site key to .env.production
- Deploy + test (Network tab)

### Phase 3: Activate Firestore Writes (Semaine 2)
- Uncomment trackConversion() Firestore code
- Deploy Cloud Function (logConversion)
- Enable Firestore rules enforcement
- Monitor Firebase Console (verified rate)

### Phase 4: V4 Intelligence (Semaine 3-4)
- Implement Archive Intelligence (TIME_RIFT_V4_PLAN.md)
- Track mode_change, era_change events
- All metrics flow through App Check secured pipeline

---

## 📝 Checklist (Copy-Paste Ready)

**Pre-Production:**
- [ ] reCAPTCHA site créé (v3 ou Enterprise)
- [ ] Site key ajoutée à .env.production
- [ ] initializeAppCheck() dans firebase.ts
- [ ] Build test: `npm run build && npm run preview`
- [ ] Console log: "[APP CHECK] Initialized successfully"
- [ ] Network tab: Token présent dans requests

**Production:**
- [ ] Deploy avec env vars configurées
- [ ] Test sur domaine prod (pas localhost)
- [ ] Firebase Console → App Check: Verified rate > 95%
- [ ] Firestore rules: enforceAppCheck actif
- [ ] Cloud Functions: enforceAppCheck: true
- [ ] Monitor quotas (reCAPTCHA admin)

**Post-Activation:**
- [ ] Uncomment Firestore writes (conversionTracking.ts)
- [ ] Deploy Cloud Function (logConversion)
- [ ] Test end-to-end: Click → Firestore write visible
- [ ] Monitor costs (Firebase Console → Usage)

---

**NEXT:** Ship v3.0 maintenant (App Check pas bloquant). Configurer App Check semaine 1.
