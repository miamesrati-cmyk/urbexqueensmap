# 🔥 Fix Firestore CORS Error

## ❌ Erreur actuelle
```
Fetch API cannot load https://firestore.googleapis.com/... due to access control checks
```

## ✅ Solutions (dans l'ordre)

### 1. **Firebase Console - Authorized Domains** (RECOMMANDÉ)
👉 https://console.firebase.google.com/project/urbexqueenscanada/authentication/settings

**Étapes :**
- Onglet **"Sign-in method"** → **"Authorized domains"** (en bas)
- Vérifiez que `localhost` est dans la liste
- Si absent : **Add domain** → `localhost`
- Si présent : **Retirez-le** puis **rajoutez-le** (force refresh)

### 2. **Google Cloud Console - API Key**
👉 https://console.cloud.google.com/apis/credentials?project=urbexqueenscanada

**Étapes :**
- Trouvez la clé API (correspond à `VITE_FIREBASE_API_KEY` dans `.env`)
- Cliquez dessus
- **Application restrictions** :
  - ✅ Recommandé pour dev : **None**
  - ✅ Pour prod : **HTTP referrers** avec :
    - `http://localhost:5173/*`
    - `http://localhost/*`
    - `https://urbexqueenscanada.web.app/*` (production)

### 3. **Fix immédiat - Désactiver restrictions (dev only)**
```bash
# Dans Google Cloud Console → API Key
# Set: "API restrictions" → "Don't restrict key"
```

### 4. **Clear cache navigateur**
```bash
# Chrome/Safari
Cmd + Shift + R  # Hard reload

# Ou en mode incognito
Cmd + Shift + N  # Nouvelle fenêtre privée
```

### 5. **Désactiver extensions navigateur**
- uBlock Origin
- Privacy Badger
- Autres extensions qui bloquent les trackers

---

## 🔍 Diagnostic rapide

```bash
# Vérifier que Firestore se connecte
npm run dev

# Ouvrir console navigateur
# Chercher: "[UQ] ⚠️ Firestore CORS"
```

**Si l'erreur persiste après les étapes ci-dessus :**
- Redémarrez le serveur dev (`npm run dev`)
- Redémarrez votre navigateur
- Testez en mode incognito
- Vérifiez `.env` : `VITE_FIREBASE_API_KEY` est-elle correcte ?

---

## 📝 Code amélioré

✅ `src/lib/firestoreHelpers.ts` - Gestion automatique des erreurs CORS
✅ `src/main.tsx` - Filtre console pour masquer spam CORS

**L'app continue de fonctionner même avec CORS** (erreur non-bloquante).
