# 🔐 Guide de Réactivation App Check

## ⚠️ Pourquoi c'est important

**App Check est actuellement DÉSACTIVÉ** dans `src/lib/firebase.ts` ligne 54.

**Impact:**
- ❌ Site vulnérable aux attaques bots
- ❌ Pas de protection contre l'abuse de Firestore
- ❌ Coûts Firebase potentiellement élevés

---

## 📋 Étapes pour Réactiver (Sans modifier le code)

### Étape 1: Enregistrer le Debug Token dans Firebase Console

1. **Ouvrir Firebase Console**
   ```
   https://console.firebase.google.com/project/YOUR_PROJECT/appcheck
   ```

2. **Naviguer vers App Check**
   - Dans le menu latéral: **Build** → **App Check**
   - Cliquer sur **Apps** en haut

3. **Manage Debug Tokens**
   - Cliquer sur **"Manage debug tokens"**
   - Cliquer sur **"Add debug token"**

4. **Ajouter le token**
   ```
   Token: be270a1f-35b0-489c-b7a0-9eadd116c952
   Name: Local Dev Token
   ```
   
   - Cliquer sur **"Add"**

5. **Vérifier l'enregistrement**
   - Le token devrait apparaître dans la liste
   - Status: ✅ Active

---

### Étape 2: Décommenter le Code App Check

**Fichier:** `src/lib/firebase.ts`

**Lignes à décommenter:** 56-71

```typescript
// AVANT (actuellement commenté):
/*
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
*/
console.info("[Firebase] AppCheck temporairement désactivé pour le dev");

// APRÈS (décommenté):
if (shouldInitializeAppCheck) {
  const provider = appCheckSiteKey
    ? new ReCaptchaV3Provider(appCheckSiteKey)
    : new CustomProvider({
        async getToken() {
          throw new Error(
            "App Check debug provider does not support manual token requests."
          );
        },
      });

  appCheckInstance = initializeAppCheck(app, {
    provider,
    isTokenAutoRefreshEnabled: true,
  });
}
// console.info("[Firebase] AppCheck temporairement désactivé pour le dev"); ← Commenter cette ligne
```

---

### Étape 3: Vérifier les Variables d'Environnement

**Fichier:** `.env` ou `.env.local`

Vérifier que tu as:
```bash
VITE_FIREBASE_APP_CHECK_KEY=your-recaptcha-v3-site-key
```

**Si tu n'as pas de clé reCAPTCHA v3:**

1. Aller sur: https://www.google.com/recaptcha/admin
2. Créer une nouvelle clé reCAPTCHA v3
3. Domaines autorisés:
   - `localhost` (pour dev)
   - `ton-domaine.web.app` (pour prod)
4. Copier la clé du site
5. Ajouter dans `.env`:
   ```bash
   VITE_FIREBASE_APP_CHECK_KEY=6LcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

---

### Étape 4: Tester en Local

1. **Redémarrer le serveur dev**
   ```bash
   npm run dev
   ```

2. **Ouvrir la console du navigateur**
   - Aller sur `http://localhost:5173`
   - Ouvrir DevTools (F12)
   - Onglet Console

3. **Vérifier les logs**
   ```
   ✅ BON:
   [Firebase] App Check initialized
   
   ❌ ERREUR:
   [Firebase] App Check debug token not registered
   [Firebase] App Check token refresh failed
   ```

4. **Si erreur:**
   - Vérifier que le token est bien enregistré dans Firebase Console
   - Vérifier que `VITE_FIREBASE_APP_CHECK_KEY` est correct
   - Vider le cache: `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (Windows)

---

### Étape 5: Tester un Appel Firestore

**Dans la console du navigateur:**
```javascript
// Essayer de lire des places
const { getDocs, collection } = await import('firebase/firestore');
const { db } = await import('./src/lib/firebase');

const snapshot = await getDocs(collection(db, 'places'));
console.log('Places count:', snapshot.size);

// Si ça fonctionne = App Check OK ✅
// Si erreur "App Check token refresh failed" = Problème ❌
```

---

### Étape 6: Déployer en Production

1. **Build de production**
   ```bash
   npm run build
   ```

2. **Vérifier qu'il n'y a pas d'erreurs**

3. **Déployer**
   ```bash
   firebase deploy --only hosting
   ```

4. **Tester sur le site de production**
   - Ouvrir `https://ton-site.web.app`
   - Vérifier console (pas d'erreurs App Check)
   - Tester navigation (Map, Feed, Profile)

---

## 🔍 Troubleshooting

### Erreur: "App Check token refresh failed"

**Cause:** Debug token non enregistré ou invalide

**Solution:**
1. Vérifier dans Firebase Console que le token est bien là
2. Copier-coller le token exactement (pas d'espace)
3. Attendre 1-2 minutes (propagation)
4. Rafraîchir la page

---

### Erreur: "reCAPTCHA site key is invalid"

**Cause:** `VITE_FIREBASE_APP_CHECK_KEY` incorrect ou manquant

**Solution:**
1. Vérifier `.env` ou `.env.local`
2. Vérifier que la clé commence par `6L`
3. Vérifier que le domaine est autorisé dans reCAPTCHA Console
4. Redémarrer `npm run dev`

---

### App Check fonctionne en dev mais pas en prod

**Cause:** Domain restrictions sur reCAPTCHA

**Solution:**
1. Aller sur https://www.google.com/recaptcha/admin
2. Modifier ta clé reCAPTCHA
3. Ajouter ton domaine de production:
   - `ton-site.web.app`
   - `ton-site.firebaseapp.com`
4. Sauvegarder
5. Attendre 5-10 minutes (propagation)
6. Re-déployer si nécessaire

---

## ✅ Checklist de Réactivation

- [ ] Debug token enregistré dans Firebase Console
- [ ] Code App Check décommenté dans `firebase.ts`
- [ ] `VITE_FIREBASE_APP_CHECK_KEY` ajouté dans `.env`
- [ ] `npm run dev` redémarré
- [ ] Console du navigateur sans erreurs
- [ ] Appel Firestore test réussi
- [ ] Build de production OK
- [ ] Déployé en production
- [ ] Testé sur le site de production
- [ ] Surveillance Sentry/Firebase Console pendant 24h

---

## 📊 Monitoring après Réactivation

**Pendant 24-48h après activation, surveiller:**

1. **Firebase Console → Usage**
   - Reads/Writes normaux
   - Pas de spike soudain

2. **Firebase Console → App Check**
   - Token refresh rate
   - Failed verifications (devrait être ~0%)

3. **Console navigateur des utilisateurs**
   - Demander à quelques beta testers de vérifier
   - Pas d'erreurs App Check

4. **Sentry (si configuré)**
   - Pas d'augmentation des erreurs

---

## 🆘 En Cas de Problème Critique

**Si App Check cause des problèmes en production:**

1. **Rollback rapide**
   ```bash
   cd /Users/minaqueen/urbex-canada/urbex-map
   git checkout src/lib/firebase.ts
   npm run build
   firebase deploy --only hosting
   ```

2. **Enquêter calmement**
   - Vérifier logs Firebase Console
   - Vérifier console navigateur
   - Vérifier Sentry

3. **Corriger et re-déployer**

---

**Temps estimé total:** 15-30 minutes  
**Difficulté:** 🟡 Moyenne (configuration Firebase Console)
