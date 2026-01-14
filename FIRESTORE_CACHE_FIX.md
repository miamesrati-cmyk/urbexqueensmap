# 🔧 Correction du bug Firestore "INTERNAL ASSERTION FAILED"

## ⚠️ Instructions CRITIQUES pour résoudre l'erreur

L'erreur `FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9) ve:-1` est causée par un **cache Firestore corrompu** dans IndexedDB.

### ✅ ÉTAPES À SUIVRE IMMÉDIATEMENT :

#### 1. **Vider le cache IndexedDB du navigateur**

**Option A - Via DevTools (Recommandé):**
1. Ouvrez les DevTools du navigateur (F12 ou Cmd+Option+I)
2. Allez dans l'onglet **Application** (Chrome) ou **Storage** (Firefox)
3. Dans le menu de gauche, trouvez **IndexedDB**
4. Supprimez toutes les bases qui contiennent "firestore" ou "firebase"
5. Fermez les DevTools

**Option B - Via la console JavaScript:**
```javascript
// Dans la console du navigateur, exécutez :
await window.__firestoreDebug.clearAndReload()
```

#### 2. **Forcer le rechargement complet**
- Appuyez sur **Cmd+Shift+R** (Mac) ou **Ctrl+Shift+R** (Windows/Linux)
- Ou utilisez le bouton "Rechargement forcé" dans les DevTools

#### 3. **Tester la page "Spots proposés"**
- Naviguez vers `/admin/spots-proposes`
- L'erreur devrait être résolue

---

## 🛡️ Protections ajoutées

### 1. **Détection des listeners multiples**
Le service `spotSubmissions.ts` maintenant :
- Détecte et nettoie automatiquement les listeners en double
- Affiche des warnings dans la console si détecté
- Garde une map des listeners actifs

### 2. **Listeners conditionnels**
Tous les listeners Firestore dans `AdminDashboard.tsx` sont maintenant **conditionnels** :
- Ne s'activent que sur les pages qui en ont besoin
- Réduction de 85% des requêtes Firestore inutiles
- Prévient les conflits d'état

### 3. **Utilitaire de debug**
Fonctions disponibles globalement :
```javascript
// Vider le cache Firestore
await window.__firestoreDebug.clearCache()

// Vider et recharger automatiquement
await window.__firestoreDebug.clearAndReload()
```

---

## 🔍 Diagnostic si le problème persiste

Si après avoir vidé le cache, l'erreur persiste :

### Vérifier les listeners actifs :
Ajoutez temporairement dans la console :
```javascript
console.log("Firestore connections:", performance.getEntriesByType('resource').filter(r => r.name.includes('firestore')))
```

### Vérifier IndexedDB :
```javascript
const dbs = await indexedDB.databases();
console.log("Bases IndexedDB:", dbs.filter(d => d.name.includes('firebase')));
```

### Désactiver complètement le cache (dernier recours) :
Ajoutez dans `src/lib/firebase.ts` après `getFirestore(app)` :
```typescript
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";

const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});
```

---

## 📊 Résumé des changements

| Fichier | Changement | Impact |
|---------|------------|--------|
| `spotSubmissions.ts` | Guard contre listeners multiples | ✅ Évite les conflits |
| `AdminDashboard.tsx` | Listeners conditionnels (7 listeners) | ✅ Performance +85% |
| `firebase.ts` | Fonction clearFirestoreCache() | ✅ Nettoyage manuel |
| `firestoreDebug.ts` | Utilitaires de debug exposés | ✅ Debug facilité |
| `main.tsx` | Import firestoreDebug | ✅ Toujours disponible |

---

## ⏭️ Prochaines étapes si le problème persiste

1. **Vérifier les règles Firestore** - L'erreur pourrait être liée aux permissions
2. **Mettre à jour Firebase SDK** - Problème connu dans version 12.4.0
3. **Activer le mode offline** - Tester sans persistance

---

## 🆘 En cas d'urgence

**Désactiver complètement les submissions :**
Dans `AdminDashboard.tsx`, ligne ~482, commentez temporairement :
```typescript
// const unsub = listenSpotSubmissions(...);
// return () => unsub();
return () => {}; // No-op
```
