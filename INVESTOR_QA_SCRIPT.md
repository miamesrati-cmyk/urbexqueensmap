# 🧪 INVESTOR QA SCRIPT — UrbexQueens Access Control

## 🎯 Objectif

Valider que **aucune feature Pro n'est accessible sans souscription** et que **toutes les actions "inscrit requis" bloquent les guests**.

**Temps estimé:** 15 minutes (avec screenshots optionnels)

---

## 📋 Pré-requis

1. **Environnement:** Dev server running (`npm run dev`)
2. **Test Accounts:**
   - Guest: Non connecté (navigation privée ou logout)
   - Free: Email de test inscrit, pas de Pro
   - Pro: Email de test inscrit + Pro actif
   - Admin: Email admin (optionnel pour scénarios 9-10)
3. **Console ouverte:** Vérifier logs `[ACCESS]` pour diagnostics

---

## 🧪 Scénarios de Test

### **Scenario 1: Guest → Satellite Style (Pro-only)**

**Rôle:** Guest (non connecté)

**Actions:**
1. Charger la map principale (`/map`)
2. Cliquer sur le bouton **"SATELLITE 🔒"**

**Attendu Console:**
```
[ACCESS] Vue Satellite — Réservée PRO blocked: Authentication required
```

**Attendu UI:**
- ✅ Modal "Upgrade to Pro" s'ouvre
- ✅ Bouton **disabled** (grisé)
- ✅ Lock icon 👑 visible
- ❌ Style ne change PAS (reste Night)

**Pass Criteria:** ✅ Paywall s'ouvre, aucun changement de style

---

### **Scenario 2: Free → Cluster Toggle (Pro-only)**

**Rôle:** Free (connecté, pas Pro)

**Actions:**
1. Se connecter avec compte Free
2. Cliquer sur le bouton **"🔍 CLUSTER 👑"**

**Attendu Console:**
```
[ACCESS] Clustering blocked: non-Pro user
[ACCESS] Cluster — Vision Stratégique blocked: Pro subscription required
```

**Attendu UI:**
- ✅ Modal "Upgrade to Pro" s'ouvre
- ✅ Bouton **disabled** (grisé)
- ✅ Lock icon 👑 visible
- ❌ Clustering n'est PAS activé

**Pass Criteria:** ✅ Paywall s'ouvre, spots restent individuels

---

### **Scenario 3: Pro → Cluster Toggle (Should Work)**

**Rôle:** Pro (connecté + Pro actif)

**Actions:**
1. Se connecter avec compte Pro
2. Cliquer sur le bouton **"🔍 CLUSTER"**

**Attendu Console:**
```
[CLUSTER] toggle before=false after=true storage=true
[CLUSTER REF] Synced ref with state: true
```

**Attendu UI:**
- ✅ Bouton devient actif (`is-active` class)
- ✅ Spots proches se regroupent en clusters
- ✅ Clusters affichent un nombre (ex: "5")
- ✅ Pas de lock icon visible

**Pass Criteria:** ✅ Clustering fonctionne, spots regroupés correctement

---

### **Scenario 4: Guest → Ghost Echo Lite (Should Work)**

**Rôle:** Guest (non connecté)

**Actions:**
1. Charger la map principale (`/map`)
2. Cliquer sur le bouton **"👻 GHOST ECHO"**

**Attendu Console:**
```
[GHOST ECHO] LITE ON → [N] spots (cosmetic ambiance)
```

**Attendu UI:**
- ✅ Glow violet cosmétique apparaît sur les spots
- ✅ Badge 🌟 visible sur le bouton
- ✅ Opacity faible (0.25)
- ❌ Pas de heatmap (seulement circles)

**Pass Criteria:** ✅ Lite mode fonctionne (cosmétique uniquement)

---

### **Scenario 5: Free → Ghost Echo Intel (Pro-only)**

**Rôle:** Free (connecté, pas Pro)

**Actions:**
1. Se connecter avec compte Free
2. Cliquer sur **"👻 GHOST ECHO"** jusqu'à essayer d'accéder au mode Intel

**Attendu Comportement:**
- ✅ Click 1: Lite mode (cosmétique) s'active
- ✅ Click 2: Lite mode se désactive (off)
- ✅ Cycle se répète: off ↔ lite uniquement
- ❌ Intel mode n'est JAMAIS accessible

**Attendu Console:**
```
[GHOST ECHO] LITE ON → [N] spots (cosmetic ambiance)
[GHOST ECHO] OFF → all layers hidden + opacity 0
```

**Pass Criteria:** ✅ Free users ne peuvent PAS accéder à Intel mode

---

### **Scenario 6: Pro → Ghost Echo Intel (Should Work)**

**Rôle:** Pro (connecté + Pro actif)

**Actions:**
1. Se connecter avec compte Pro
2. Cliquer sur **"👻 GHOST ECHO"** 3 fois

**Attendu Comportement:**
- ✅ Click 1: Lite mode (cosmétique)
- ✅ Click 2: **Intel mode** (heatmap + glow)
- ✅ Click 3: Off
- ✅ Click 4: Cycle recommence (Lite)

**Attendu Console:**
```
[GHOST ECHO] LITE ON → [N] spots (cosmetic ambiance)
[GHOST ECHO] INTEL ON → [N] spots (exploitable patterns)
[GHOST ECHO] OFF → all layers hidden + opacity 0
```

**Attendu UI (Intel mode):**
- ✅ Heatmap visible (gradient bleu → violet → rouge)
- ✅ Badge ⚡ visible sur le bouton
- ✅ Densité exploitable (zones denses = rouge/orange)
- ✅ Glow circles à high zoom (z12+)

**Pass Criteria:** ✅ Intel mode fonctionne, heatmap visible

---

### **Scenario 7: Guest → Toggle Done (Auth required)**

**Rôle:** Guest (non connecté)

**Actions:**
1. Cliquer sur un spot sur la map
2. Popup s'ouvre
3. Cliquer sur le bouton **"Marquer comme fait"** ou **"✓ Done"**

**Attendu Console:**
```
[MapRoute] toggle done: requireAuth needed
```

**Attendu UI:**
- ✅ Modal "Se connecter" s'ouvre
- ❌ Done status ne change PAS
- ✅ CTA: "Se connecter pour marquer"

**Pass Criteria:** ✅ Auth modal s'ouvre, aucune modification de data

---

### **Scenario 8: Free → Toggle Done (Should Work)**

**Rôle:** Free (connecté, pas Pro)

**Actions:**
1. Se connecter avec compte Free
2. Cliquer sur un spot sur la map
3. Cliquer sur **"✓ Marquer comme fait"**

**Attendu Console:**
```
[MapRoute] handleToggleDone called { placeId: "...", userId: "..." }
[Done] Marked as done: [placeId]
```

**Attendu UI:**
- ✅ Checkmark devient actif (✓ rempli)
- ✅ Couleur change (ex: vert)
- ✅ Tooltip: "Déjà fait"

**Attendu Backend:**
- ✅ Document créé: `users/{uid}/done/{placeId}`
- ✅ Timestamp `doneAt` présent

**Pass Criteria:** ✅ Done fonctionne, document Firestore créé

---

### **Scenario 9: Guest → Time Rift (Pro-only)**

**Rôle:** Guest (non connecté)

**Actions:**
1. Charger la map principale (`/map`)
2. Cliquer sur le bouton **"🕰️ TIME RIFT 🔒"**

**Attendu Console:**
```
[CONVERSION TRACKING] Time Rift paywall opened
[ACCESS] Time Rift — Voyage Temporel blocked: Authentication required
```

**Attendu UI:**
- ✅ Animation "time glitch" (300ms)
- ✅ Modal "Upgrade to Pro" s'ouvre
- ✅ Bouton **disabled** (grisé) avec lock icon
- ❌ Time Rift overlay n'apparaît PAS

**Pass Criteria:** ✅ Paywall + animation, aucun overlay visible

---

### **Scenario 10: Pro → Time Rift Decay (Should Work)**

**Rôle:** Pro (connecté + Pro actif)

**Actions:**
1. Se connecter avec compte Pro
2. Cliquer sur **"🕰️ TIME RIFT"**
3. Sélectionner mode **"DECAY"**

**Attendu Console:**
```
[TIME RIFT] DECAY ON → [N] spots
```

**Attendu UI:**
- ✅ Time Rift panel s'ouvre
- ✅ Mode selector visible: **DECAY | INTELLIGENCE | ARCHIVES**
- ✅ Heatmap Decay apparaît (gradient entropy)
- ✅ Dots overlay visible
- ✅ Légende "Decay Score" affichée

**Attendu Backend:**
- ✅ Aucune query `proData` si pas de data (graceful fallback)
- ✅ Si data existe: affichée correctement

**Pass Criteria:** ✅ Decay mode fonctionne, heatmap visible

---

## 🚨 Critical Failure Scenarios (Must NOT Happen)

### ❌ **FAIL 1: Guest accède à Satellite**
- **Test:** Guest clique Satellite → style change
- **Impact:** Feature Pro leakée, perte revenue
- **Fix:** Vérifier `disabled={!isProUser}` dans `MapProPanel.tsx`

### ❌ **FAIL 2: Free accède à Intel mode**
- **Test:** Free cycle Ghost Echo → Intel mode visible
- **Impact:** Feature Pro leakée, perte différenciation
- **Fix:** Vérifier tier logic dans `handleGhostToggle` (MapRoute.tsx L2132-2144)

### ❌ **FAIL 3: Guest écrit Done sans auth**
- **Test:** Guest clique Done → document créé dans Firestore
- **Impact:** Fuite sécurité backend
- **Fix:** Vérifier Firestore Rules `users/{uid}/done/` (auth required)

### ❌ **FAIL 4: Free query proData via console**
- **Test:** Free ouvre console → `getDoc(db, "places", placeId, "proData", "main")`
- **Impact:** Fuite data Pro
- **Fix:** Vérifier Firestore Rules `places/{id}/proData/` (Pro-only read)

---

## 📊 Pass Criteria Summary

| Scenario | Pass Criteria | Status |
|----------|---------------|--------|
| 1. Guest → Satellite | ✅ Paywall, no style change | ⬜ TODO |
| 2. Free → Cluster | ✅ Paywall, no clustering | ⬜ TODO |
| 3. Pro → Cluster | ✅ Works, spots cluster | ⬜ TODO |
| 4. Guest → Ghost Lite | ✅ Works, cosmetic glow | ⬜ TODO |
| 5. Free → Ghost Intel | ❌ Blocked, lite only | ⬜ TODO |
| 6. Pro → Ghost Intel | ✅ Works, heatmap visible | ⬜ TODO |
| 7. Guest → Toggle Done | ✅ Auth modal, no write | ⬜ TODO |
| 8. Free → Toggle Done | ✅ Works, doc created | ⬜ TODO |
| 9. Guest → Time Rift | ✅ Paywall + animation | ⬜ TODO |
| 10. Pro → Time Rift Decay | ✅ Works, heatmap visible | ⬜ TODO |

---

## 🔬 Advanced Backend Verification (Optional, 5 min)

### **Test A: Firestore Rules (proData)**

**Command (Firebase Console):**
```javascript
// Try as Guest (should fail)
const proData = await getDoc(doc(db, "places", "test-place-id", "proData", "main"));
// Expected: permission-denied
```

**Pass:** ✅ Permission denied for Guest/Free

---

### **Test B: CollectionGroup Query (Intelligence)**

**Command (Firebase Console):**
```javascript
// Try as Free user (should fail)
const query = query(collectionGroup(db, "proData"), where("yearAbandoned", ">=", 1950));
const snap = await getDocs(query);
// Expected: permission-denied
```

**Pass:** ✅ Permission denied for Free

---

### **Test C: Done Write (Auth required)**

**Command (Firebase Console):**
```javascript
// Try as Guest (should fail)
await setDoc(doc(db, "users", "guest-uid", "done", "place-id"), { doneAt: new Date() });
// Expected: permission-denied
```

**Pass:** ✅ Permission denied for Guest

---

## ✅ Sign-Off Checklist

Before marking audit as **COMPLETE**, verify:

- [ ] All 10 scenarios pass criteria
- [ ] No critical failures observed
- [ ] Console logs match expected (no errors)
- [ ] Firestore Rules verified for proData, done, saved
- [ ] No UI bypass (disabled buttons stay disabled)
- [ ] No data leak (Guest/Free cannot read proData)
- [ ] Analytics tracking fires (paywall opens logged)
- [ ] UX messaging consistent ("Backrooms elite" style)

---

## 🎯 Investor Proof

**When complete:**
1. ✅ Take screenshots of each scenario (paywall modals, heatmaps, etc.)
2. ✅ Export console logs (show `[ACCESS]` blocks working)
3. ✅ Record 2-minute video: Guest → tries Pro features → all blocked
4. ✅ Share Firestore Rules snippet showing Pro-only enforcement

**Deliverable:** 1-page PDF with screenshots + "All scenarios passed ✅"

---

**Last Updated:** 2026-01-23  
**Status:** 🟡 Ready for execution (awaiting manual QA)
