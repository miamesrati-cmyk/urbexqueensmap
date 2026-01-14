# 🧪 Guide de Test Rapide - Composants Ajoutés

## 🚀 Avant de tester

1. **Rafraîchir la page** (Cmd+R ou F5)
2. **Ouvrir la console** (F12 ou Cmd+Option+I)
3. **Se connecter** si pas déjà connecté

---

## ✅ Test 1 : Compteurs de Spots (ProfileMenu)

**Étapes** :
1. Cliquer sur votre photo de profil (coin supérieur droit)
2. Vérifier que le menu affiche :
   - ✅ **Spots faits** : [nombre]
   - 💗 **Sauvegardés** : [nombre]

**Résultat attendu** :
- Les compteurs affichent des nombres (0 ou plus)
- Pas d'erreurs dans la console

**Erreur potentielle** :
```
❌ Missing or insufficient permissions (userPlaces)
→ Redéployer les règles : firebase deploy --only firestore:rules --force
```

---

## ✅ Test 2 : Modal de Listes (SpotListsModal)

**Étapes** :
1. Ouvrir le menu profil
2. Cliquer sur **"✅ Spots faits"**
3. Vérifier que le modal s'ouvre avec l'onglet "Faits" actif
4. Cliquer sur l'onglet **"Favoris"**
5. Vérifier que la liste change

**Résultat attendu** :
- Modal s'ouvre immédiatement
- Liste affiche les spots correspondants
- Onglets changent de couleur quand actifs
- Bouton "×" ferme le modal

**Erreur potentielle** :
```
❌ buildUserSpotCollections is not defined
→ Vérifier import dans SpotListsModal.tsx
```

---

## ✅ Test 3 : Popup Gaming (Map)

**Étapes** :
1. Cliquer sur n'importe quel pin sur la carte
2. Vérifier le style du popup :
   - Background dégradé bleu foncé
   - Bordure animée (rotation de couleurs néon)
   - Effet de glow autour
3. Vérifier qu'il n'y a **PAS** d'icône de tier dupliquée dans le titre
4. Cliquer sur **"✅ Marquer fait"**
5. Vérifier que le badge **"CONQUIS"** apparaît

**Résultat attendu** :
- Popup avec style gaming ultra visible
- Animation de bordure fluide (8 secondes par rotation)
- Badge "CONQUIS" en vert fluo quand marqué
- Compteur "Spots faits" incrémente dans le menu

**Erreur potentielle** :
```
❌ [TOGGLE][write] userPlaces write failed: Missing or insufficient permissions
→ Vérifier règles Firestore pour userPlaces/{userId}
```

---

## ✅ Test 4 : Boutons PRO (Map)

**Étapes** :
1. Vérifier que 4 boutons apparaissent sur le côté gauche de la carte :
   - 🔵 **CLUSTER**
   - 🟢 **ROUTE**
   - 🟡 **HISTORY**
   - 🔴 **FILTER**
2. Cliquer sur **CLUSTER**
3. Ouvrir la console et vérifier le log :
   ```
   [PRO] Clustering: true
   ```
4. Re-cliquer sur CLUSTER
5. Vérifier le log :
   ```
   [PRO] Clustering: false
   ```

**Résultat attendu** :
- Boutons visibles et cliquables
- État toggle visuellement (bordure change)
- Logs dans la console
- Pas de crash

**Note** :
⚠️ Les fonctionnalités réelles (clustering, route, etc.) ne sont pas encore implémentées. C'est normal que seul l'état change.

---

## ✅ Test 5 : Feed Page (Permissions)

**Étapes** :
1. Naviguer vers `/feed` ou cliquer sur l'onglet "Feed"
2. Ouvrir la console
3. Vérifier qu'il n'y a **PLUS** ces erreurs :
   ```
   ❌ ReferenceError: medium is not defined
   ❌ <button> cannot contain nested <button>
   ❌ Missing or insufficient permissions (postViews)
   ❌ Missing or insufficient permissions (savedPosts)
   ```

**Résultat attendu** :
- Page charge sans erreurs 500
- Cartes de posts cliquables
- Boutons "❤️" (like), "💗" (save), "💬" (comment) fonctionnent
- Navigation clavier (Tab puis Enter) fonctionne

**Warnings OK** :
```
⚠️ The report-only Content Security Policy '' was delivered via a <meta> element
→ Warning non bloquant, ignorable
```

---

## ✅ Test 6 : Persistence des Données

**Étapes** :
1. Marquer un spot comme fait sur la carte
2. Vérifier que le compteur "Spots faits" incrémente
3. **Rafraîchir la page** (Cmd+R)
4. Ouvrir le menu profil
5. Vérifier que le compteur affiche toujours le même nombre
6. Cliquer à nouveau sur le même spot
7. Vérifier que le badge "CONQUIS" est toujours présent

**Résultat attendu** :
- État persiste après refresh
- Compteurs affichent les bonnes valeurs
- Popup montre toujours "CONQUIS" pour les spots marqués

**Erreur potentielle** :
```
❌ [TOGGLE][snapshot] undefined
→ Vérifier que listenUserPlaces est bien appelé dans MapRoute
```

---

## 🐛 Dépannage Rapide

### Problème : Compteurs affichent toujours 0

**Solution** :
```bash
# Vérifier les règles Firestore
firebase deploy --only firestore:rules --force

# Vérifier dans la console :
console.log(userPlaces); // Doit afficher un objet, pas {}
```

### Problème : Modal ne s'ouvre pas

**Solution** :
```javascript
// Dans la console navigateur :
window.dispatchEvent(new CustomEvent('spot-lists-view', { 
  detail: { view: 'done' } 
}));

// Si ça fonctionne, le problème vient de ProfileMenu
// Si ça ne fonctionne pas, le problème vient de l'event listener dans MapRoute
```

### Problème : Popup pas stylé gaming

**Solution** :
```javascript
// Vérifier que les styles sont chargés
document.querySelector('.uq-spot-popup')?.computedStyleMap()

// Si null, vérifier que src/styles.css est importé
```

### Problème : Permissions Firestore

**Solution** :
```bash
# Redéployer les règles
firebase deploy --only firestore:rules --force

# Vérifier le statut
firebase deploy --only firestore:rules --debug
```

---

## 📊 Checklist Finale

Avant de valider que tout fonctionne :

- [ ] ✅ Compteurs affichent des nombres réels
- [ ] 💗 Modal s'ouvre et affiche les listes
- [ ] 🎮 Popup a le style gaming avec animations
- [ ] 🔵 Boutons PRO changent d'état
- [ ] 📰 Feed charge sans erreurs
- [ ] 🔄 Données persistent après refresh
- [ ] ❌ Pas d'erreurs "permission-denied" dans console
- [ ] ❌ Pas d'erreurs "undefined" dans console

---

## ✅ Si Tout Fonctionne

**Console devrait montrer** :
```
[Firebase] AppCheck temporairement désactivé pour le dev
[UQ][CFG] applied datasets
[UQ][PRO] change { isPro: false }
[TOGGLE][snapshot] Raw data from Firestore: { places: {...} }
```

**Sans erreurs** :
- ❌ Missing or insufficient permissions
- ❌ ReferenceError
- ❌ TypeError
- ❌ FirebaseError

---

## 🎉 Validation Complète

Si tous les tests passent :

**🟢 PROJET STABLE ET COHÉRENT** ✅

Prochaines étapes :
1. Tests utilisateurs réels
2. Feedback sur l'UX gaming
3. Implémentation des fonctionnalités PRO complètes
4. Optimisations de performance
