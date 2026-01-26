# 🔒 MIGRATION PRO DATA → SOUS-COLLECTION

**Date:** 22 janvier 2026  
**Status:** 🔴 **CRITIQUE — REQUIS AVANT PRODUCTION**  
**Raison:** Backend data gating (Firestore Rules field-level masking impossible)

---

## ⚠️ CONTEXTE: POURQUOI CETTE MIGRATION?

### **Problème identifié:**
```
places/{id}
├─ historyFull         ❌ Lisible par tous (allow read: if true)
├─ yearAbandoned       ❌ Contournable via SDK direct
└─ yearLastSeen        ❌ Client-side filtering insuffisant
```

**Conséquence:** Un user non-Pro peut:
1. Ouvrir DevTools console
2. Faire `firebase.firestore().collection('places').doc(id).get()`
3. Lire `historyFull` même si UI le masque

**Verdict investisseur:** ❌ Pas investor-grade

---

## ✅ SOLUTION: SOUS-COLLECTION PROTÉGÉE

### **Architecture cible:**
```
places/{id}                    ← Public data
├─ title, lat, lng
├─ historyTeaser (preview)
└─ historyIsPro (boolean flag)

places/{id}/proData/main       ← Pro-only data (BACKEND ENFORCED)
├─ historyFull
├─ historyFullHtml
├─ yearAbandoned
└─ yearLastSeen
```

### **Firestore Rule:**
```javascript
match /places/{placeId}/proData/{doc} {
  allow read: if isSignedIn() && isPro();  // ✅ Backend enforced
  allow write: if isAdmin();
}
```

**Impact:** Guest/Free **ne peuvent physiquement pas** lire `proData` (permission denied au niveau Firestore).

---

## 🛠️ ÉTAPES DE MIGRATION

### **1. Backup (OBLIGATOIRE)**

Avant toute migration, backup complet:

```bash
# Export Firestore
gcloud firestore export gs://[BUCKET_NAME]/backups/pre-prodata-migration

# Ou via Firebase Console:
# Firebase Console → Firestore → ... → Import/Export
```

**⚠️ NE PAS SKIP CETTE ÉTAPE**

---

### **2. Test Dry-Run (preview)**

```bash
cd scripts
npm install firebase-admin  # Si pas déjà installé

# Preview sans écrire
node migrate-pro-data.js --dry-run
```

**Output attendu:**
```
🔒 MIGRATION PRO DATA → SUBCOLLECTION
Mode: DRY RUN (preview only)
...
📊 MIGRATION SUMMARY
Total places: 342
Migrated: 89
Skipped (no Pro data): 253
```

**Valide que:**
- Script détecte correctement les places avec Pro data
- Pas d'erreurs de parsing
- Count cohérent avec ta base

---

### **3. Migration LIVE**

```bash
# Migration (garde fields originaux comme backup)
node migrate-pro-data.js

# OU migration + cleanup (supprime fields originaux)
node migrate-pro-data.js --cleanup
```

**⚠️ Recommandation:** Faire SANS `--cleanup` d'abord:
1. Migrer vers `proData`
2. Tester app 48h
3. Si tout OK → cleanup manuel après

---

### **4. Déployer Firestore Rules**

```bash
firebase deploy --only firestore:rules
```

**Valide que:**
- Rules compile sans erreur
- Test via Firebase Emulator:
  ```bash
  firebase emulators:start --only firestore
  ```

---

### **5. Update Client Code (services/places.ts)**

Voir fichier `services/places.ts` — changes requis:

```typescript
// AVANT (ancien code)
const historyFull = raw.historyFull || "";

// APRÈS (fetch proData si isPro)
async function buildPlaceFromRecord(id, raw, userTier) {
  // ... build base place ...
  
  if ((userTier === "pro" || userTier === "admin") && raw.historyIsPro) {
    const proDataRef = doc(db, "places", id, "proData", "main");
    const proDataSnap = await getDoc(proDataRef);
    
    if (proDataSnap.exists()) {
      const proData = proDataSnap.data();
      place.historyFull = proData.historyFull || "";
      place.yearAbandoned = proData.yearAbandoned || null;
      // ...
    }
  }
  
  return place;
}
```

**Impact:** Pro users fetch automatiquement `proData`, Guest/Free ne fetch jamais (permission denied si tentative).

---

## ✅ CHECKLIST VALIDATION

### **Avant migration:**
- [ ] Backup Firestore complet
- [ ] Dry-run migration script (pas d'erreurs)
- [ ] Service account key configuré (`serviceAccountKey.json`)
- [ ] Firebase CLI logged in (`firebase login`)

### **Pendant migration:**
- [ ] Migration script terminé sans erreurs
- [ ] Vérifier manuellement 3-5 places dans Firebase Console:
  - [ ] `places/{id}/proData/main` existe
  - [ ] Fields `historyFull`, `yearAbandoned` présents

### **Après migration:**
- [ ] Deploy Firestore Rules
- [ ] Test Emulator: Guest query `proData` → permission denied
- [ ] Test Emulator: Pro query `proData` → success
- [ ] Update client code (services/places.ts fetch conditionnel)
- [ ] Test app: Pro user voit histoire complète
- [ ] Test app: Guest/Free ne voient PAS histoire complète
- [ ] Monitor console 48h (pas d'erreurs permission denied spam)

### **Cleanup (optionnel, après 48h monitoring):**
- [ ] Re-run migration avec `--cleanup` flag (supprime fields originaux)
- [ ] Ou cleanup manuel via script:
  ```javascript
  const batch = db.batch();
  places.forEach(place => {
    batch.update(place.ref, {
      historyFull: admin.firestore.FieldValue.delete(),
      yearAbandoned: admin.firestore.FieldValue.delete(),
    });
  });
  await batch.commit();
  ```

---

## 🎯 RÉSULTAT FINAL

**Avant migration:**
- ❌ Pro data lisible via SDK direct (contournement possible)
- 🟡 Client-side filtering = défense en profondeur (insuffisant seul)

**Après migration:**
- ✅ Pro data **backend enforced** (Firestore Rules)
- ✅ Impossible de contourner (permission denied au niveau DB)
- ✅ Investor-grade data gating
- ✅ Scalable (ajouter fields Pro sans toucher places)

---

## 📊 IMPACT BUSINESS

**Pour investisseurs:**
- ✅ "Pro data gating backend enforced" → audit-proof
- ✅ Architecture scalable (subcollections)
- ✅ Pas de breach possible via DevTools

**Pour users:**
- ✅ Pro users: aucun changement visible (fetch transparent)
- ✅ Guest/Free: pas d'impact (jamais eu accès anyway)

**Pour dev:**
- 🟡 Migration one-time (acceptable, script automatisé)
- ✅ Queries légèrement plus complexes (fetch conditionnel proData)
- ✅ Maintenance simplifiée (separation of concerns)

---

## 🚨 ERREURS FRÉQUENTES À ÉVITER

### **1. Oublier le backup**
❌ **Jamais** migrer sans backup  
✅ Toujours exporter Firestore avant

### **2. Déployer Rules avant migration**
❌ Si tu deploy Rules avant migration, queries client vont fail  
✅ Ordre: Migration → Update client → Deploy Rules

### **3. Ne pas tester Emulator**
❌ Deploy direct en prod sans test  
✅ Test local avec Emulator d'abord

### **4. Cleanup immédiat**
❌ `--cleanup` dans la première run (pas de rollback facile)  
✅ Garder fields originaux 48h minimum

---

## 📚 COMMANDES UTILES

```bash
# Dry-run
node migrate-pro-data.js --dry-run

# Migration LIVE (garde fields)
node migrate-pro-data.js

# Migration + cleanup
node migrate-pro-data.js --cleanup

# Deploy Rules
firebase deploy --only firestore:rules

# Test Emulator
firebase emulators:start --only firestore

# Vérifier une place spécifique (Firebase CLI)
firebase firestore:get places/{PLACE_ID}/proData/main
```

---

**Prochaine étape:** Exécuter dry-run, valider counts, puis migration LIVE.

**Blockers:** Service account key requis (télécharger depuis Firebase Console).

**ETA:** 30 min setup + 5 min migration + 1h tests = ~2h total.
