# 🔒 SPAM LOCK PATCH V4 — COMPREHENSIVE FIRESTORE SAFETY

**Date**: 2025-01-XX  
**Status**: IN PROGRESS  
**Root Cause**: 77 await Firestore calls without try/catch → unhandled promise rejections → permission-denied spam (513x/5s)  
**Solution**: Wrap ALL unsafe Firestore calls with try/catch + permission-denied guard

---

## 🔍 DISCOVERY PHASE

### Stack Fingerprinting (v4 Partie 1)
```
[ACCESS] 🔍 MOST COMMON STACK (513x):
node_modules/.vite/deps/firebase_firestore.js:12623
```

**Key Finding**: NO app files in stack trace → Firestore Promise rejections (await without try/catch)

### AST Scanner Results (v4 Partie 2)
```bash
🔍 Scanning 205 files for unsafe Firestore patterns...
❌ Found 77 unsafe patterns:

Breakdown:
  - onSnapshot without error callback: 0 ✅ (fixed in v1-v3)
  - await Firestore without try/catch: 77 ❌
```

---

## 📋 COMPREHENSIVE PATCH LIST (77 calls)

### File Breakdown:
1. **reactions.ts** — 2 unsafe
2. **achievements.ts** — 1 unsafe
3. **adminConfigs.ts** — 7 unsafe
4. **comments.ts** — 3 unsafe
5. **dm.ts** — 2 unsafe
6. **enigmas.ts** — 1 unsafe
7. **follows.ts** — 7 unsafe
8. **gamification.ts** — 3 unsafe
9. **layouts.ts** — 1 unsafe
10. **missions.ts** — 1 unsafe
11. **notifications.ts** — 2 unsafe
12. **places.ts** — 6 unsafe
13. **postsLikes.ts** — 3 unsafe
14. **proGames.ts** — 1 unsafe
15. **savedPosts.ts** — 3 unsafe
16. **shop.ts** — 9 unsafe
17. **social.ts** — 14 unsafe
18. **spotPhotos.ts** — 1 unsafe
19. **submissions.ts** — 1 unsafe
20. **userProfiles.ts** — 9 unsafe
21. **users.ts** — 1 unsafe
22. **userSettings.ts** — 2 unsafe

---

## 🔧 PATCHING STRATEGY

### Pattern A: Single Read Operations
**Example**: `await getDoc(ref)` → returns DocumentSnapshot
```typescript
// BEFORE
const snap = await getDoc(ref);
return snap.exists() ? snap.data() : null;

// AFTER
try {
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
} catch (e: any) {
  if (e?.code === "permission-denied") {
    if (import.meta.env.DEV) {
      console.warn(`[getDoc] permission-denied: ${ref.path}`);
    }
    return null;
  }
  captureException(e);
  return null;
}
```

### Pattern B: Write Operations
**Example**: `await setDoc/updateDoc/deleteDoc`
```typescript
// BEFORE
await setDoc(ref, payload);

// AFTER
try {
  await setDoc(ref, payload);
} catch (e: any) {
  if (e?.code === "permission-denied") {
    if (import.meta.env.DEV) {
      console.warn(`[setDoc] permission-denied: ${ref.path}`);
    }
  } else {
    captureException(e);
  }
  throw e; // Re-throw for caller to handle
}
```

### Pattern C: Queries (getDocs)
**Example**: `await getDocs(query)` → returns QuerySnapshot
```typescript
// BEFORE
const snap = await getDocs(q);
return snap.docs.map(d => ({ id: d.id, ...d.data() }));

// AFTER
try {
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
} catch (e: any) {
  if (e?.code === "permission-denied") {
    if (import.meta.env.DEV) {
      console.warn(`[getDocs] permission-denied`);
    }
    return [];
  }
  captureException(e);
  return [];
}
```

### Pattern D: Transactions
**Example**: `await runTransaction`
```typescript
// BEFORE
await runTransaction(db, async (tx) => {
  const snap = await tx.get(ref);
  // ... transaction logic
});

// AFTER
try {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    // ... transaction logic
  });
} catch (e: any) {
  if (e?.code === "permission-denied") {
    if (import.meta.env.DEV) {
      console.warn(`[runTransaction] permission-denied`);
    }
  } else {
    captureException(e);
  }
  throw e;
}
```

---

## 🎯 FALLBACK VALUES BY OPERATION

| Operation | Fallback Value | Rationale |
|-----------|---------------|-----------|
| `getDoc` | `null` | Indicates document not found/accessible |
| `getDocs` | `[]` | Empty list is safe default |
| `getCountFromServer` | `{ count: 0 }` | Zero count safe default |
| `setDoc/updateDoc/deleteDoc` | `throw e` | Re-throw for caller to handle (void operations) |
| `addDoc` | `throw e` | Caller needs doc reference |
| `runTransaction` | `throw e` | Transactions must succeed or fail explicitly |

---

## ✅ CHECKLIST (22 files)

- [ ] reactions.ts (2)
- [ ] achievements.ts (1)
- [ ] adminConfigs.ts (7)
- [ ] comments.ts (3)
- [ ] dm.ts (2)
- [ ] enigmas.ts (1)
- [ ] follows.ts (7)
- [ ] gamification.ts (3)
- [ ] layouts.ts (1)
- [ ] missions.ts (1)
- [ ] notifications.ts (2)
- [ ] places.ts (6)
- [ ] postsLikes.ts (3)
- [ ] proGames.ts (1)
- [ ] savedPosts.ts (3)
- [ ] shop.ts (9)
- [ ] social.ts (14)
- [ ] spotPhotos.ts (1)
- [ ] submissions.ts (1)
- [ ] userProfiles.ts (9)
- [ ] users.ts (1)
- [ ] userSettings.ts (2)

---

## 🚀 EXECUTION PLAN

1. **Patch all 77 calls** (60-90 min)
2. **Build verification**: `npm run build` (2 min)
3. **User test spam elimination**: Hard refresh → idle 15s → login → idle 15s
4. **Expected**: `✅ SPAM ELIMINATED — 0 permission-denied after idle 15s`
5. **Resume QA Ghost Echo**: Scenarios 2-6
6. **Tag + Deploy**: `core-map-v1` → production

---

## 📊 PROGRESS TRACKER

**Completed**: 0/22 files (0/77 calls)  
**In Progress**: reactions.ts  
**Remaining**: 21 files

---

**Next Action**: Start patching reactions.ts (2 calls)
