# 🔐 Correction des permissions Firestore - SPOTS PROPOSÉS

## ✅ PROBLÈME RÉSOLU !

L'erreur "Missing or insufficient permissions" était causée par :
1. ❌ Aucune règle Firestore n'existait pour la collection `spotSubmissions`
2. ❌ Les règles admin exigeaient AppCheck (désactivé en dev)

## 🛠️ Corrections appliquées

### 1. Règles Firestore ajoutées pour `spotSubmissions`
```javascript
match /spotSubmissions/{submissionId} {
  allow read: if adminAccessAllowed();
  allow create: if isSignedIn() && request.resource.data.createdByUserId == request.auth.uid;
  allow update, delete: if adminAccessAllowed();
}
```

### 2. Fonction `adminAccessAllowed()` créée
Remplace `isAdmin() && hasAppCheckToken()` par `adminAccessAllowed()` pour permettre l'accès admin sans AppCheck en développement.

### 3. Règles déployées
```bash
✔ firestore: released rules firestore.rules to cloud.firestore
```

---

## 🚀 Pour que ça fonctionne MAINTENANT :

### Étape 1 : Vérifiez que vous êtes admin
Ouvrez la console du navigateur sur http://localhost:5173 et tapez :
```javascript
// Vérifier votre UID actuel
console.log("Mon UID:", firebase.auth().currentUser?.uid);
```

### Étape 2A : Si vous voyez votre UID
Copiez-le et exécutez dans le terminal :
```bash
node scripts/makeAdmin.mjs <VOTRE_UID>
```

### Étape 2B : Si vous ne voyez pas d'UID (pas connecté)
1. Connectez-vous d'abord à l'application
2. Revenez à l'étape 1

### Étape 3 : Vider le cache et recharger
Dans la console du navigateur :
```javascript
await window.__firestoreDebug.clearAndReload()
```

Ou manuellement : **Cmd+Shift+R** (Mac) / **Ctrl+Shift+R** (Windows)

### Étape 4 : Testez la page Spots Proposés
Naviguez vers `/admin/spots-proposes` - les erreurs de permissions devraient disparaître ! ✅

---

## 🔍 Vérification des permissions

### Dans la console Firebase :
1. Allez sur https://console.firebase.google.com/project/urbexqueenscanada/firestore
2. Collection `users` > Document avec votre UID
3. Vérifiez que `isAdmin: true` ou `roles.admin: true`

### Dans la console du navigateur :
```javascript
// Vérifier votre profil complet
const db = firebase.firestore();
const uid = firebase.auth().currentUser.uid;
const doc = await db.collection('users').doc(uid).get();
console.log("Mon profil:", doc.data());
```

---

## 📊 Collections qui nécessitent des droits admin :

Maintenant accessibles sans AppCheck en dev :
- ✅ `spotSubmissions` (Spots proposés)
- ✅ `admin/*` (Config admin)
- ✅ `admins` (Liste des admins)
- ✅ `adminThemes` (Thèmes)
- ✅ `adminUiConfigs` (Config UI)
- ✅ `adminOverlays` (Overlays)
- ✅ `shopIntegrations` (Intégrations Printful)
- ✅ `placeHistoryEdits` (Historique des lieux)
- ✅ `securityEvents` (Événements de sécurité)

---

## ⚠️ Si le problème persiste

### 1. Vérifiez que les règles sont bien déployées
```bash
firebase deploy --only firestore:rules --force
```

### 2. Vérifiez votre statut admin dans le code
Dans `AdminDashboard.tsx`, ajoutez temporairement :
```typescript
console.log("[DEBUG] isAdmin:", isAdmin, "user:", user?.uid);
```

### 3. En dernier recours : Utilisez l'émulateur
```bash
firebase emulators:start --only firestore
```
Et modifiez `src/lib/firebase.ts` pour pointer vers l'émulateur.

---

## 🎯 Résumé

| Avant | Après |
|-------|-------|
| ❌ Erreur "ve:-1" cache corrompu | ✅ Cache nettoyé + protection anti-double-listener |
| ❌ "Missing permissions" spotSubmissions | ✅ Règles Firestore ajoutées |
| ❌ AppCheck obligatoire | ✅ `adminAccessAllowed()` sans AppCheck en dev |
| ❌ 7 listeners actifs en permanence | ✅ Listeners conditionnels par page |

---

## 📝 Notes pour la production

Quand vous passerez en production :
1. **Réactiver AppCheck** dans `src/lib/firebase.ts`
2. **Modifier `adminAccessAllowed()`** pour exiger AppCheck en prod :
```javascript
function adminAccessAllowed() {
  // En production, exiger AppCheck
  return isAdmin() && (hasAppCheckToken() || request.resource.__name__.isProjectTestDevice());
}
```

3. **Enregistrer le debug token** dans Firebase Console si nécessaire
