# 🔒 ACCESS AUDIT PHASE 2 — Sprint Dédié

**Status:** 🟡 Planned (not blocking Ghost Echo deployment)  
**Priority:** High (12 high-risk features identified)  
**Estimate:** 6-8 hours (1 focused sprint)  
**Dependencies:** Ghost Echo deployed as `core-map-v1`

---

## 📊 CONTEXT

### Phase 1 Complete ✅

**Delivered:**
- ✅ MapRoute + MapProPanel audit (11/37 features verified)
- ✅ ACCESS_MATRIX.md created (comprehensive access control documentation)
- ✅ accessGates.ts enhanced (20 FeatureKey types, FEATURE_LOCKS microcopy)
- ✅ INVESTOR_QA_SCRIPT.md created (10 test scenarios)
- ✅ Ghost Echo production checks complete (style switch, off-mode, intel data-driven)

**Current State:**
- **Core exploration engine** (Ghost Echo, MapRoute) is production-ready
- **Secondary features** (Spot Detail, Social, Admin) are documented but not yet audited
- **Defense in depth:** Layer 1 (UI) 55%, Layer 2 (Logic) 35%, Layer 3 (Backend) 25%
- **Overall audit score:** C+ (55% complete)

---

## 🎯 PHASE 2 OBJECTIVES

**Goal:** Reach A+ audit score (100% coverage) for investor-grade security

**Scope:**
1. Audit Spot Detail actions (Comment, Upload Photo, Edit, Delete, Add Intel, Claim)
2. Audit Social features (Post Activity, Like/React, DM, Upload Story)
3. Protect Pro/Admin routes (Dashboard, Missions, Admin Panel)
4. Verify Firestore Rules (all write operations)
5. Sweep patches (replace ad hoc checks with centralized gates)
6. Create AuthLock/ProLock wrapper components (optional enhancement)

---

## 📋 DETAILED TASKS

### 1️⃣ Audit Spot Detail Actions (2-3 hours)

**Files to audit:**
- `src/components/PlaceModal.tsx` (or equivalent spot detail component)
- `src/pages/SpotDetailRoute.tsx` (if separate route exists)
- `src/components/CommentComposer.tsx`
- `src/components/PhotoUploader.tsx`

**Actions to verify:**

#### 🔹 Comment on Spot
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("comment", user, onAuthRequired)`
- **Risk:** 🔴 High (Guest could write comments without auth)
- **Guard location:** CommentComposer.tsx → handleSubmit
- **Data path:** Firestore `places/{placeId}/comments` collection
- **Backend verification:** Check `firestore.rules` for auth requirement

#### 🔹 Upload Photo
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("upload-photo", user, onAuthRequired)` + Storage rules
- **Risk:** 🔴 High (Guest could upload photos, bypass moderation)
- **Guard location:** PhotoUploader.tsx → handleUpload
- **Data path:** Firebase Storage `places/{placeId}/photos/`
- **Backend verification:** Check `storage.rules` for auth requirement

#### 🔹 Edit Spot
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("edit-spot", user, onAuthRequired)` + ownership check
- **Risk:** 🟡 Medium (User could edit other users' spots)
- **Guard location:** PlaceModal.tsx → handleEdit
- **Data path:** Firestore `places/{placeId}` document
- **Ownership check:** `place.addedBy === user.uid`
- **Backend verification:** Check `firestore.rules` for ownership requirement

#### 🔹 Delete Spot
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("delete-spot", user, onAuthRequired)` + ownership check
- **Risk:** 🟡 Medium (User could delete other users' spots)
- **Guard location:** PlaceModal.tsx → handleDelete
- **Data path:** Firestore `places/{placeId}` document
- **Ownership check:** `place.addedBy === user.uid` OR `isAdmin`
- **Backend verification:** Check `firestore.rules` for ownership requirement

#### 🔹 Add Intel (Pro-only)
- **Current state:** Unknown (needs audit)
- **Expected:** `requirePro("add-intel", user, isPro, onUpgradeRequired)`
- **Risk:** 🔴 High (Free user could write to proData subcollection)
- **Guard location:** PlaceModal.tsx → handleAddIntel
- **Data path:** Firestore `places/{placeId}/proData` subcollection
- **Backend verification:** Check `firestore.rules` for Pro-only write

#### 🔹 Claim Spot (from Missions)
- **Current state:** Unknown (needs audit)
- **Expected:** `requirePro("claim-spot", user, isPro, onUpgradeRequired)`
- **Risk:** 🔴 High (Free user could claim Pro missions)
- **Guard location:** MissionCard.tsx → handleClaim
- **Data path:** Firestore `missions/{missionId}` document + `places/{placeId}`
- **Backend verification:** Check `firestore.rules` for Pro-only claim

**Deliverable:** Update ACCESS_MATRIX.md with findings for all 6 actions

---

### 2️⃣ Audit Social Features (1-2 hours)

**Files to audit:**
- `src/components/SocialFeed.tsx`
- `src/components/FeedInteractions.tsx`
- `src/components/ActivityComposer.tsx`
- `src/components/DirectMessages.tsx`

**Actions to verify:**

#### 🔹 Post Activity (Free-tier)
- **Current state:** Partial (onRequireAuth callback exists in SocialFeed.tsx)
- **Expected:** `requireAuth("post-activity", user, onAuthRequired)`
- **Risk:** 🔴 High (Guest could write activities without auth)
- **Guard location:** ActivityComposer.tsx → handlePost
- **Data path:** Firestore `activities` collection
- **Backend verification:** Check `firestore.rules` for auth requirement

#### 🔹 Like/React to Activity (Free-tier)
- **Current state:** Partial (onRequireAuth callback exists in FeedInteractions.tsx)
- **Expected:** `requireAuth("like-activity", user, onAuthRequired)`
- **Risk:** 🟡 Medium (Guest could like without auth, inflate engagement)
- **Guard location:** FeedInteractions.tsx → handleLike
- **Data path:** Firestore `activities/{activityId}` document (likes array)
- **Backend verification:** Check `firestore.rules` for auth requirement

#### 🔹 Direct Message (Free-tier)
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("direct-message", user, onAuthRequired)`
- **Risk:** 🔴 High (Guest could spam DMs, no moderation trail)
- **Guard location:** DirectMessages.tsx → handleSend
- **Data path:** Firestore `messages` collection
- **Backend verification:** Check `firestore.rules` for sender/receiver auth

#### 🔹 Upload Story (Free-tier)
- **Current state:** Unknown (needs audit)
- **Expected:** `requireAuth("upload-story", user, onAuthRequired)` + Storage rules
- **Risk:** 🔴 High (Guest could upload inappropriate content)
- **Guard location:** StoryComposer.tsx → handleUpload
- **Data path:** Firebase Storage `stories/` + Firestore `stories` collection
- **Backend verification:** Check `storage.rules` + `firestore.rules` for auth

**Deliverable:** Update ACCESS_MATRIX.md with findings for all 4 social actions

---

### 3️⃣ Protect Pro/Admin Routes (1 hour)

**Routes to protect:**

#### 🔹 Pro Dashboard (`/pro` or `/dashboard`)
- **Current state:** Unknown (needs route protection verification)
- **Expected:** Route guard redirects Guest/Free to upgrade page
- **Risk:** 🔴 Critical (Free user could access Pro-only UI, see Pro features)
- **Implementation:** Create `<ProRoute>` wrapper or add guard in route definition
- **Test:** Direct URL access as Free user → should redirect to `/upgrade`

#### 🔹 Missions (`/missions`)
- **Current state:** Unknown (needs route protection verification)
- **Expected:** Route guard redirects Guest/Free to upgrade page
- **Risk:** 🔴 Critical (Free user could see Pro missions, attempt claims)
- **Implementation:** Use `<ProRoute>` wrapper
- **Test:** Direct URL access as Free user → should redirect

#### 🔹 Admin Panel (`/admin`)
- **Current state:** Unknown (needs route protection verification)
- **Expected:** Route guard redirects non-Admin to home page
- **Risk:** 🔴 Critical (User could access admin controls, moderate content)
- **Implementation:** Create `<AdminRoute>` wrapper with `requireAdmin` guard
- **Test:** Direct URL access as Pro user (non-Admin) → should redirect

**Deliverable:** Create route wrapper components, update ACCESS_MATRIX.md

---

### 4️⃣ Verify Firestore Rules (1 hour)

**File to audit:** `firestore.rules`

**Collections to verify:**

#### 🔹 `places` collection
- **Write operations:** Create, update, delete
- **Expected rules:**
  - Create: Auth required (`request.auth != null`)
  - Update: Ownership check (`resource.data.addedBy == request.auth.uid`) OR Admin
  - Delete: Ownership check OR Admin
- **Verify:** Read rules (Guest can read basic fields, proData blocked for non-Pro)

#### 🔹 `places/{placeId}/proData` subcollection
- **Write operations:** Create, update, delete
- **Expected rules:**
  - Write: Pro-only (`request.auth.token.stripeRole == 'premium'`) OR Admin
  - Read: Pro-only OR Admin
- **Current state:** ✅ Already verified (permission-denied for Free user)

#### 🔹 `places/{placeId}/comments` subcollection
- **Write operations:** Create, update, delete
- **Expected rules:**
  - Create: Auth required (`request.auth != null`)
  - Update: Ownership check (`resource.data.userId == request.auth.uid`) OR Admin
  - Delete: Ownership check OR Admin

#### 🔹 `activities` collection
- **Write operations:** Create, update, delete
- **Expected rules:**
  - Create: Auth required
  - Update: Ownership check (`resource.data.userId == request.auth.uid`)
  - Delete: Ownership check OR Admin

#### 🔹 `messages` collection
- **Write operations:** Create, update, delete
- **Expected rules:**
  - Create: Auth required, sender must be `request.auth.uid`
  - Read: Sender or receiver only (`request.auth.uid in [resource.data.senderId, resource.data.receiverId]`)
  - Update/Delete: Sender only OR Admin

#### 🔹 `missions` collection
- **Write operations:** Update (claim), create (Admin-only)
- **Expected rules:**
  - Claim (update): Pro-only, not already claimed
  - Create: Admin-only
  - Delete: Admin-only

#### 🔹 `stories` collection
- **Write operations:** Create, delete
- **Expected rules:**
  - Create: Auth required, expires in 24h
  - Delete: Ownership check OR Admin OR auto-delete after 24h

**Deliverable:** Document Firestore Rules status in ACCESS_MATRIX.md, fix any gaps

---

### 5️⃣ Sweep Patches (1 hour - optional)

**Goal:** Replace ad hoc checks with centralized gates from `accessGates.ts`

**Pattern to replace:**

```typescript
// ❌ Old (scattered, inconsistent)
if (!isPro) {
  onUpgradeRequired();
  return;
}

// ✅ New (centralized, consistent)
if (!requirePro("satellite", user, isPro, onUpgradeRequired)) {
  return;
}
```

**Files to sweep:**
- `src/pages/MapRoute.tsx` (handleSatelliteToggle, handleClusterToggle, etc.)
- `src/components/MapProPanel.tsx` (all Pro-only toggles)
- `src/components/PlaceModal.tsx` (Add Intel, Edit, Delete)
- `src/components/SocialFeed.tsx` (Post, Like)

**Benefit:** Single source of truth, consistent UX microcopy, easier to maintain

**Deliverable:** Updated components using centralized gates

---

### 6️⃣ Create Lock Components (1 hour - optional enhancement)

**Goal:** Simplify UI gating with wrapper components

**Implementation:**

```typescript
// src/components/access/AuthLock.tsx
export function AuthLock({ 
  feature, 
  user, 
  onAuthRequired, 
  children 
}: AuthLockProps) {
  if (!user) {
    return (
      <Tooltip title={explainLock(feature).teaser}>
        <span onClick={() => onAuthRequired(feature)}>
          {children}
        </span>
      </Tooltip>
    );
  }
  return children;
}

// src/components/access/ProLock.tsx
export function ProLock({ 
  feature, 
  user, 
  isPro, 
  onUpgradeRequired, 
  children 
}: ProLockProps) {
  if (!isPro) {
    return (
      <Tooltip title={explainLock(feature).teaser}>
        <span onClick={() => onUpgradeRequired(feature)}>
          {children}
        </span>
      </Tooltip>
    );
  }
  return children;
}
```

**Usage:**

```typescript
// ❌ Old
<button 
  disabled={!isPro} 
  onClick={() => {
    if (!isPro) {
      onUpgradeRequired();
      return;
    }
    handleSatelliteToggle();
  }}
>
  Satellite
</button>

// ✅ New
<ProLock feature="satellite" user={user} isPro={isPro} onUpgradeRequired={onUpgradeRequired}>
  <button onClick={handleSatelliteToggle}>
    Satellite
  </button>
</ProLock>
```

**Benefit:** Cleaner JSX, consistent lock UI, easier to add lock icons/badges

**Deliverable:** AuthLock.tsx + ProLock.tsx components, usage examples in MapRoute

---

## 📊 SUCCESS CRITERIA

**Phase 2 is COMPLETE when:**
- ✅ All 37 features in ACCESS_MATRIX.md have defense in depth verified (UI + logic + backend)
- ✅ 12 high-risk items (Spot Detail + Social) have guards implemented
- ✅ 5 critical items (Pro/Admin routes) have route protection implemented
- ✅ Firestore Rules verified for all write operations (7 collections)
- ✅ Overall audit score: A+ (100% coverage)
- ✅ Defense in depth: Layer 1 (100%), Layer 2 (100%), Layer 3 (100%)

**Optional enhancements:**
- ✅ Ad hoc checks replaced with centralized gates (sweep patches)
- ✅ AuthLock/ProLock wrapper components created

---

## 🎯 EXECUTION PLAN

### Sprint Structure (6-8 hours)

**Day 1 (3-4 hours):**
- Task 1: Audit Spot Detail actions (2-3 hours)
- Task 2: Audit Social features (1-2 hours)

**Day 2 (3-4 hours):**
- Task 3: Protect Pro/Admin routes (1 hour)
- Task 4: Verify Firestore Rules (1 hour)
- Task 5: Sweep patches (1 hour - optional)
- Task 6: Create Lock Components (1 hour - optional)

---

## 📦 DELIVERABLES

**Required:**
1. ✅ ACCESS_MATRIX.md updated (all 37 features verified, A+ grade)
2. ✅ Firestore Rules verified (all 7 collections documented)
3. ✅ Route wrapper components created (ProRoute.tsx, AdminRoute.tsx)
4. ✅ High-risk actions have guards (Comment, Upload, Add Intel, Post, DM)
5. ✅ PHASE2_ACCESS_AUDIT.md updated with completion status

**Optional:**
6. ✅ AuthLock.tsx + ProLock.tsx wrapper components
7. ✅ MapRoute/MapProPanel refactored to use centralized gates

---

## 🚀 READY TO START

**Prerequisites:**
- ✅ Ghost Echo deployed as `core-map-v1`
- ✅ ACCESS_MATRIX.md baseline exists
- ✅ accessGates.ts enhanced with 20 FeatureKey types
- ✅ INVESTOR_QA_SCRIPT.md available for testing

**To begin Phase 2:**
1. Open this file (`PHASE2_ACCESS_AUDIT.md`)
2. Start with Task 1 (Audit Spot Detail)
3. Update ACCESS_MATRIX.md as you verify each feature
4. Cross off tasks in checklist below

---

## ✅ TASK CHECKLIST

**Audit Tasks:**
- [ ] Audit Comment action (PlaceModal.tsx / CommentComposer.tsx)
- [ ] Audit Upload Photo action (PhotoUploader.tsx)
- [ ] Audit Edit Spot action (PlaceModal.tsx)
- [ ] Audit Delete Spot action (PlaceModal.tsx)
- [ ] Audit Add Intel action (PlaceModal.tsx → proData write)
- [ ] Audit Claim Spot action (MissionCard.tsx)
- [ ] Audit Post Activity action (ActivityComposer.tsx)
- [ ] Audit Like/React action (FeedInteractions.tsx)
- [ ] Audit Direct Message action (DirectMessages.tsx)
- [ ] Audit Upload Story action (StoryComposer.tsx)

**Route Protection:**
- [ ] Create ProRoute.tsx wrapper component
- [ ] Create AdminRoute.tsx wrapper component
- [ ] Protect Pro Dashboard route (`/pro` or `/dashboard`)
- [ ] Protect Missions route (`/missions`)
- [ ] Protect Admin Panel route (`/admin`)
- [ ] Test direct URL access (should redirect for unauthorized users)

**Backend Verification:**
- [ ] Verify `places` collection rules (create, update, delete)
- [ ] Verify `places/{placeId}/proData` subcollection rules (already ✅)
- [ ] Verify `places/{placeId}/comments` subcollection rules
- [ ] Verify `activities` collection rules
- [ ] Verify `messages` collection rules
- [ ] Verify `missions` collection rules (claim, create)
- [ ] Verify `stories` collection rules (create, auto-delete)
- [ ] Verify Storage rules (photos, stories)

**Optional Enhancements:**
- [ ] Create AuthLock.tsx wrapper component
- [ ] Create ProLock.tsx wrapper component
- [ ] Sweep MapRoute.tsx (replace ad hoc checks)
- [ ] Sweep MapProPanel.tsx (replace ad hoc checks)
- [ ] Sweep PlaceModal.tsx (replace ad hoc checks)
- [ ] Sweep SocialFeed.tsx (replace ad hoc checks)

**Final Deliverables:**
- [ ] ACCESS_MATRIX.md updated (A+ grade, 100% coverage)
- [ ] PHASE2_ACCESS_AUDIT.md marked complete
- [ ] All high-risk items resolved (no 🔴 in ACCESS_MATRIX.md)
- [ ] Firestore Rules documented (Layer 3 verified)
- [ ] Manual QA test (pick 5 random scenarios from INVESTOR_QA_SCRIPT.md)

---

## 🎉 COMPLETION SIGN-OFF

**Date completed:** ______________  
**Auditor:** ______________  
**Final audit score:** _____ (target: A+ / 100%)  
**Defense in depth:** Layer 1 _____%, Layer 2 _____%, Layer 3 _____% (target: 100% all layers)

**Investor narrative:**  
_"All access controls have been systematically verified across UI, logic, and backend layers. The application enforces tiered access (Guest/Free/Pro/Admin) consistently across all 37 features. High-risk attack vectors (unauthorized writes, Pro feature leakage) have been eliminated through defense in depth."_

---

**🔒 Once complete, UrbexQueens access controls are investor-grade and production-safe!**
