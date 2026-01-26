# 🔒 ACCESS MATRIX — UrbexQueens (Investor-Grade)

## 📊 Matrice Complète d'Accès par Feature

### 🗺️ MAP CONTROLS (MapRoute + MapProPanel)

| Feature | Guest | Free | Pro | Guard Location | Data Path | Leak Risk | Notes |
|---------|-------|------|-----|----------------|-----------|-----------|-------|
| **View Map** | ✅ View | ✅ View | ✅ View | None (public) | `places` collection (public fields only) | 🟢 None | Base feature |
| **Style Switch (Satellite)** | ❌ Blocked | ❌ Blocked | ✅ Yes | `MapProPanel.tsx` L243 + L285 | None (UI only) | 🟢 None | UI gate + disabled |
| **Ghost Echo Lite** | ✅ Toggle (no persist) | ✅ Toggle (persist) | ✅ Toggle (persist) | `MapRoute.tsx` L2129-2162 | `places` collection | 🟢 None | Tiered access implemented ✅ |
| **Ghost Echo Intel** | ❌ Blocked | ❌ Blocked | ✅ Yes | `MapRoute.tsx` L2132-2144 | `places` collection + decayScore | 🟢 None | Pro-only heatmap ✅ |
| **Time Rift (Decay)** | ❌ Blocked | ❌ Blocked | ✅ Yes | `MapProPanel.tsx` L330 | `places` collection + proData | 🟡 **CHECK** | historyActive gate needs backend verification |
| **Time Rift (Intelligence)** | ❌ Blocked | ❌ Blocked | ✅ Yes | Time Rift controller | `proData` subcollection (collectionGroup) | 🟢 None | Backend enforced ✅ |
| **Time Rift (Archives)** | ❌ Blocked | ❌ Blocked | ✅ Yes | Time Rift controller | None (raster tiles) | 🟢 None | UI gate only |
| **Cluster Toggle** | ❌ Blocked | ❌ Blocked | ✅ Yes | `MapProPanel.tsx` L243-256 | None (UI rendering) | 🟢 None | UI gate + disabled + `onUpgradeRequired` ✅ |
| **Route Planner** | ❌ Blocked | ❌ Blocked | ✅ Yes | `MapProPanel.tsx` L285-302 | None (client-side routing) | 🟢 None | UI gate + `onUpgradeRequired` ✅ |
| **Epic Filter** | ✅ Yes | ✅ Yes | ✅ Yes | `MapRoute.tsx` L2118 | `places` collection (tier field) | 🟢 None | Public filter (tier shown to all) |
| **Add Spot** | ❌ Must login | ✅ Yes | ✅ Yes | `MapRoute.tsx` L2186 | `places` collection (write) | 🟡 **CHECK** | Needs backend write rules verification |
| **Toggle Done** | ❌ Must login | ✅ Yes | ✅ Yes | `MapRoute.tsx` L1823-1825 | `users/{uid}/done/{placeId}` | 🟢 None | `requireAuth` ✅ |
| **Toggle Saved** | ❌ Must login | ✅ Yes | ✅ Yes | `MapRoute.tsx` L1893-1895 | `users/{uid}/saved/{placeId}` | 🟢 None | `requireAuth` ✅ |

---

### 📍 SPOT DETAIL (Place Modal/Page)

| Feature | Guest | Free | Pro | Guard Location | Data Path | Leak Risk | Notes |
|---------|-------|------|-----|----------------|-----------|-----------|-------|
| **View Public Info** | ✅ View | ✅ View | ✅ View | None | `places/{id}` (public fields) | 🟢 None | Base feature |
| **View ProData** | ❌ Teaser | ❌ Teaser | ✅ Full | Backend (Firestore Rules) | `places/{id}/proData/main` | 🟢 None | Backend enforced ✅ |
| **historyFull** | ❌ Blocked | ❌ Blocked | ✅ Yes | Firestore Rules | `proData.historyFull` | 🟢 None | Backend enforced ✅ |
| **yearAbandoned** | ❌ Blocked | ❌ Blocked | ✅ Yes | Firestore Rules | `proData.yearAbandoned` | 🟢 None | Backend enforced ✅ |
| **yearLastSeen** | ❌ Blocked | ❌ Blocked | ✅ Yes | Firestore Rules | `proData.yearLastSeen` | 🟢 None | Backend enforced ✅ |
| **Comment** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `comments` collection | 🔴 **AUDIT** | Need to verify gate |
| **Upload Photo** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | Storage + `places/{id}/photos` | 🔴 **AUDIT** | Need to verify gate + storage rules |
| **Add Intel** | ❌ Must login | ❌ Must login | ✅ Yes | **TODO** | `proData` write | 🔴 **AUDIT** | Should be Pro-only |
| **Claim Spot** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `places/{id}` update | 🔴 **AUDIT** | Need to verify rules |
| **Edit Spot** | ❌ Blocked | 🟡 Owner only | 🟡 Owner or Admin | **TODO** | `places/{id}` update | 🔴 **AUDIT** | Need ownership check |
| **Delete Spot** | ❌ Blocked | 🟡 Owner only | 🟡 Owner or Admin | **TODO** | `places/{id}` delete | 🔴 **AUDIT** | Need ownership check |

---

### 📱 SOCIAL (UrbexFeed / Comments / Stories)

| Feature | Guest | Free | Pro | Guard Location | Data Path | Leak Risk | Notes |
|---------|-------|------|-----|----------------|-----------|-----------|-------|
| **View Feed** | ✅ View | ✅ View | ✅ View | None | `activities` collection | 🟢 None | Public read |
| **Post Activity** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `activities` collection (write) | 🔴 **AUDIT** | Need to verify gate |
| **Comment on Activity** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `activityComments` collection | 🔴 **AUDIT** | Need to verify gate |
| **Like/React** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `activities/{id}/likes` | 🔴 **AUDIT** | Need to verify gate |
| **Upload Story** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `stories` collection + Storage | 🔴 **AUDIT** | Need to verify gate + storage rules |
| **DM (Direct Message)** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | `messages` collection | 🔴 **AUDIT** | Need to verify gate |
| **Mention User** | ❌ Must login | ✅ Yes | ✅ Yes | **TODO** | Activity/Comment with @mentions | 🔴 **AUDIT** | Need to verify gate |
| **Pro Composer Features** | ❌ Blocked | ❌ Blocked | ✅ Yes | **TODO** | Unknown | 🔴 **AUDIT** | Need to identify Pro-only composer features |

---

### 🎯 PRO LOUNGE / MISSIONS / ADMIN

| Feature | Guest | Free | Pro | Guard Location | Data Path | Leak Risk | Notes |
|---------|-------|------|-----|----------------|-----------|-----------|-------|
| **View Pro Dashboard** | ❌ Blocked | ❌ Blocked | ✅ Yes | **TODO** | None (UI only) | 🔴 **AUDIT** | Need route protection |
| **View Missions** | ❌ Blocked | ❌ Blocked | ✅ Yes | **TODO** | `missions` collection | 🔴 **AUDIT** | Need route protection + backend |
| **Claim Mission Reward** | ❌ Blocked | ❌ Blocked | ✅ Yes | **TODO** | `missions/{id}` update | 🔴 **AUDIT** | Need backend validation |
| **View Pro Analytics** | ❌ Blocked | ❌ Blocked | ✅ Yes | **TODO** | User stats aggregation | 🔴 **AUDIT** | Need route protection |
| **Admin Panel** | ❌ Blocked | ❌ Blocked | 🟡 Admin only | **TODO** | Various (user management, moderation) | 🔴 **AUDIT** | Need admin-only route protection |
| **Moderate Content** | ❌ Blocked | ❌ Blocked | 🟡 Admin only | **TODO** | `places`, `comments`, `activities` | 🔴 **AUDIT** | Need admin-only backend rules |
| **Ban User** | ❌ Blocked | ❌ Blocked | 🟡 Admin only | **TODO** | `users/{uid}` update | 🔴 **AUDIT** | Need admin-only backend rules |

---

## 🚨 CRITICAL FINDINGS (Priority Fixes)

### 🔴 High Risk (Immediate Action Required)

1. **Spot Detail Actions (Comment, Upload, Edit, Delete)**
   - **Issue:** No centralized gate verification in audit
   - **Impact:** Potential unauthorized writes to Firestore
   - **Fix:** Add `requireAuth` / `requirePro` guards + verify backend rules
   - **Files:** `src/components/PlaceModal.tsx` (or equivalent detail view)

2. **Social Features (Post, Comment, Like, DM)**
   - **Issue:** Not yet audited for gates
   - **Impact:** Potential guest writes to social collections
   - **Fix:** Add `requireAuth` gates + verify backend rules
   - **Files:** `src/components/UrbexFeed.tsx`, `src/components/CommentComposer.tsx`

3. **Pro Lounge / Missions Routes**
   - **Issue:** No route-level protection verified
   - **Impact:** Direct URL access might bypass UI gates
   - **Fix:** Add `<ProRoute>` wrapper or route guard
   - **Files:** Router config (App.tsx or routes.tsx)

4. **Admin Panel**
   - **Issue:** Not yet audited for admin-only enforcement
   - **Impact:** Pro users might access admin features
   - **Fix:** Add `isAdmin` check + separate admin routes
   - **Files:** Admin components + router

---

### 🟡 Medium Risk (Should Fix Soon)

1. **Time Rift (Decay) Mode**
   - **Issue:** historyActive gate but no explicit proData fetch verification
   - **Impact:** Low (backend enforced) but should verify controller logic
   - **Fix:** Ensure Time Rift controller queries `proData` collection (already collectionGroup ✅)
   - **Status:** Likely OK (already using collectionGroup with Pro-only rules)

2. **Add Spot Backend Rules**
   - **Issue:** Frontend has gate (`requireAuth`) but backend rules need verification
   - **Impact:** Guest might bypass via API if rules missing
   - **Fix:** Verify Firestore Rules for `places` collection writes
   - **Status:** Check `firestore.rules`

3. **Ownership Checks (Edit/Delete Spot)**
   - **Issue:** No owner verification in frontend audit
   - **Impact:** User A might edit User B's spot
   - **Fix:** Add `isOwner(place, user)` check + backend rules
   - **Status:** Need to implement

---

### 🟢 Low Risk (Monitoring)

1. **Epic Filter**
   - **Status:** ✅ Public feature, no leak risk
   - **Reason:** Tier shown to all users (acquisition strategy)

2. **Ghost Echo Lite**
   - **Status:** ✅ Tiered access implemented correctly
   - **Reason:** Guest/Free see cosmetic, Pro sees intel

3. **Satellite Style**
   - **Status:** ✅ UI gate + disabled + upgrade CTA
   - **Reason:** UI-only feature, no data leak

---

## 🛡️ DEFENSE IN DEPTH VERIFICATION

### Layer 1: UI Gating ✅ (Implemented)

**Verified:**
- Satellite: `disabled={!isProUser}` + `onUpgradeRequired` ✅
- Cluster: `disabled={!isProUser}` + `onUpgradeRequired` ✅
- Route: UI gate + `onUpgradeRequired` ✅
- Ghost Echo: Tiered logic (Guest/Free/Pro) ✅
- Time Rift: UI gate + `trackTimeRiftPaywallOpen` ✅

**Missing:**
- Spot detail actions (Comment, Upload, Edit, Delete)
- Social features (Post, Like, DM)
- Pro Dashboard route protection
- Admin panel route protection

---

### Layer 2: Logic Guards 🟡 (Partial)

**Verified:**
- `requireAuth` used in: Toggle Done, Toggle Saved ✅
- `requirePro` used in: Cluster, Route, Satellite ✅
- Ghost Echo: Custom tier logic ✅

**Missing:**
- Centralized `requireAuth` / `requirePro` in:
  - Spot detail actions
  - Social composer
  - Pro Dashboard access
  - Mission claim logic

**Recommendation:** Create `<AuthLock>` and `<ProLock>` wrapper components

---

### Layer 3: Backend (Firestore Rules) ✅ (Verified for ProData)

**Verified:**
- `proData` subcollection: ✅ Pro-only read (permission denied for Guest/Free)
- CollectionGroup queries: ✅ Indexed + rules enforced

**Need Verification:**
- `places` collection write rules (Add Spot, Edit, Delete)
- `comments` collection write rules
- `activities` collection write rules
- `stories` collection + Storage rules
- `messages` collection (DM) rules
- `missions` collection write rules (claim reward)
- Admin-only rules (moderation, ban user)

**Action:** Review `firestore.rules` file for completeness

---

## 📝 NEXT STEPS (Execution Plan)

### Phase 1: Immediate Fixes (High Risk) — 2-3 hours

1. **Audit Spot Detail Actions**
   - Read `PlaceModal.tsx` (or equivalent)
   - Add `requireAuth` to Comment, Upload, Claim
   - Add `requirePro` to "Add Intel" (if exists)
   - Verify ownership for Edit/Delete

2. **Audit Social Features**
   - Read `UrbexFeed.tsx`, `CommentComposer.tsx`
   - Add `requireAuth` to all write actions
   - Verify backend rules for `activities`, `comments`

3. **Protect Pro Routes**
   - Find Pro Dashboard route definition
   - Add `<ProRoute>` wrapper or route guard
   - Test direct URL access (blocked for Guest/Free)

4. **Protect Admin Routes**
   - Find Admin Panel route definition
   - Add `<AdminRoute>` wrapper
   - Verify `isAdmin` check in backend rules

---

### Phase 2: Centralize Guards (Medium Risk) — 1-2 hours

1. **Enhance `accessGates.ts`**
   - Add feature-specific functions:
     - `canComment(user)`, `canUpload(user, feature)`, `canEditSpot(user, place)`
   - Add microcopy:
     - `explainLock(feature, tier)` → UX messaging

2. **Create Lock Components**
   - `<AuthLock feature="comment" onBlock={requireAuth}>{children}</AuthLock>`
   - `<ProLock feature="satellite" onBlock={handleUnlockPro}>{children}</ProLock>`
   - Replace scattered `if (!isPro)` with wrappers

3. **Sweep MapRoute + MapProPanel**
   - Replace ad hoc checks with `requirePro(feature, user, isPro, onUpgradeRequired)`
   - Replace ad hoc checks with `requireAuth()`

---

### Phase 3: Backend Verification (1-2 hours)

1. **Review `firestore.rules`**
   - Verify `places` write rules
   - Verify `proData` write rules (should be admin-only or Pro-only)
   - Verify `comments`, `activities`, `stories` write rules
   - Verify `missions` write rules
   - Verify admin-only rules for moderation

2. **Test Permission Denied**
   - Guest: Try to write to `places` → expect permission denied
   - Free: Try to read `proData` → expect permission denied
   - Pro: Try to write to `proData` → expect permission denied (unless admin)

---

### Phase 4: QA & Documentation (1 hour)

1. **Create INVESTOR_QA_SCRIPT.md**
   - 10 scenarios (Guest/Free/Pro)
   - Expected console logs
   - Expected UI behavior

2. **Update ACCESS_MATRIX.md**
   - Mark all audited features as ✅
   - Remove 🔴 AUDIT tags
   - Add final leak risk assessment

---

## 🎯 SUCCESS CRITERIA

**Audit Complete When:**
1. ✅ All features have explicit gate (UI + logic + backend)
2. ✅ No 🔴 AUDIT tags remaining in matrix
3. ✅ All Firestore Rules verified for write operations
4. ✅ QA script passes for all 10 scenarios (Guest/Free/Pro)
5. ✅ `accessGates.ts` is single source of truth
6. ✅ `<AuthLock>` and `<ProLock>` components exist and are used
7. ✅ No ad hoc `if (!isPro)` checks remain (all centralized)

**Investor-Grade Proof:**
- Matrix shows defense in depth (UI + logic + backend)
- No contournement possible (UI hack, API call, direct URL)
- UX lock premium cohérente ("Backrooms elite" teaser + CTA)
- Analytics tracking for conversion (paywall opens logged)

---

**Last Updated:** 2026-01-23  
**Status:** 🟡 Phase 1 In Progress (MapRoute + MapProPanel complete, Spot Detail + Social pending)
