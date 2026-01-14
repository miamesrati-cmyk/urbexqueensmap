# Guide : Gestion du Token Mapbox

## ⚠️ Problème Résolu (Janvier 2026)

**Symptôme :** Erreurs 403 sur toutes les requêtes Mapbox API
```
GET https://api.mapbox.com/v4/... 403 (Forbidden)
[UQ][MAP_FAIL] reason=style_error
```

**Cause :** Token Mapbox expiré ou invalide

**Solution :** Nouveau token créé et configuré dans `.env.local`

---

## 🔑 Token Actuel

**Fichier :** `.env.local` (à la racine du projet)
**Variable :** `VITE_MAPBOX_TOKEN`
**Format :** `pk.eyJ...` (token public Mapbox)

---

## 🛠️ Comment Créer un Nouveau Token

### 1. Accédez à votre compte Mapbox
https://account.mapbox.com/access-tokens/

### 2. Cliquez sur "Create a token"

### 3. Configuration du token

**Nom suggéré :** `Urbex Queens Production` ou `Urbex Queens Dev`

**Scopes requis (cochés par défaut) :**
- ✅ `styles:read` - Lire les styles de carte
- ✅ `fonts:read` - Lire les polices vectorielles
- ✅ `datasets:read` - Lire les données de tuiles

**URL Restrictions :**
- **Développement :** Laissez vide ou `http://localhost:*`
- **Production :** Ajoutez `https://votredomaine.com/*`

### 4. Créez et copiez le token

⚠️ **Important :** Le token ne sera affiché qu'une seule fois !

---

## 📝 Installation du Token

### Développement Local

1. Ouvrez `.env.local` à la racine du projet
2. Modifiez la ligne :
   ```env
   VITE_MAPBOX_TOKEN=COLLEZ_VOTRE_NOUVEAU_TOKEN_ICI
   ```
3. Sauvegardez (Cmd+S)
4. Redémarrez le serveur :
   ```bash
   npm run dev
   ```

### Production (Firebase)

Le token est inclus dans le build. Assurez-vous que :
1. `.env.local` contient le token valide **avant** de builder
2. Le token a les URL restrictions pour votre domaine de production
3. Après changement, faire :
   ```bash
   npm run build
   firebase deploy
   ```

---

## 🔍 Vérification du Token

### Test Rapide
```bash
# Vérifier que le token est présent
cat .env.local | grep VITE_MAPBOX_TOKEN

# Vérifier qu'il commence par "pk.eyJ"
```

### Test dans l'App
1. Ouvrez http://localhost:5173/
2. Ouvrez la console (F12)
3. Vérifiez qu'il n'y a **pas** d'erreurs :
   - ❌ `403 Forbidden` sur `api.mapbox.com`
   - ❌ `[UQ][MAP_FAIL]`
4. La carte doit charger correctement ✅

---

## 🚨 Dépannage

### Token Invalide (403)
- Token expiré → Créer un nouveau
- Mauvaise copie (espaces/retours à la ligne) → Recopier proprement
- URL restrictions trop strictes → Vérifier dans Mapbox console

### Token Manquant
- Fichier `.env.local` n'existe pas → Le créer
- Variable mal nommée → Doit être `VITE_MAPBOX_TOKEN`
- Serveur pas redémarré → `Ctrl+C` puis `npm run dev`

### Carte Ne Charge Pas
1. Vérifier console navigateur (F12)
2. Chercher erreurs Mapbox
3. Vérifier Network tab pour requêtes 403
4. Consulter ce guide

---

## 📊 Quotas et Limites

**Plan Free Mapbox :**
- 50,000 chargements de carte / mois
- Illimité en développement local

**Surveillance :**
https://account.mapbox.com/statistics/

Si vous dépassez, upgrader vers un plan payant.

---

## 🔒 Sécurité

### ✅ Bonnes Pratiques
- Token **public** (pk.) dans le code front-end = OK
- Activer URL restrictions en production
- Ne jamais utiliser de token **secret** (sk.) côté client

### ❌ À Éviter
- Partager le token publiquement sur GitHub (mais pas grave si c'est un token public)
- Utiliser le même token pour dev et prod (recommandé : 2 tokens séparés)
- Oublier les URL restrictions en production

---

## 📅 Maintenance

**Vérification Régulière :**
- [ ] Tous les 3 mois : vérifier que le token est toujours valide
- [ ] Avant chaque déploiement : tester la carte en local
- [ ] Monitorer les quotas sur Mapbox dashboard

**En Cas de Problème :**
1. Consulter ce guide
2. Vérifier la console navigateur
3. Créer un nouveau token si nécessaire
4. Mettre à jour `.env.local`
5. Redémarrer le serveur

---

**Dernière mise à jour :** Janvier 2026  
**Token actuel configuré :** Janvier 4, 2026  
**Prochaine vérification recommandée :** Avril 2026
