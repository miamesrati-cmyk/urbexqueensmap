# 🐛 BUGS & LOGIC ISSUES FOUND

## 🔴 CRITICAL (Fix Today)

### 1. Race Condition: Follow/Unfollow Counters
**File**: `firestore.rules` (line 511)
**Issue**: Multiple simultaneous follows cause incorrect follower counts
**Impact**: High - data corruption
**Fix**: Implement Cloud Function with transactions

```typescript
// functions/src/index.ts - ADD THIS
export const onFollowCreate = functions.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const { fromUid, toUid } = snap.data();
    
    await db.runTransaction(async (tx) => {
      const fromRef = db.collection('users').doc(fromUid);
      const toRef = db.collection('users').doc(toUid);
      
      tx.update(fromRef, { 
        followingCount: admin.firestore.FieldValue.increment(1) 
      });
      tx.update(toRef, { 
        followersCount: admin.firestore.FieldValue.increment(1) 
      });
    });
  });

export const onFollowDelete = functions.firestore
  .document('follows/{followId}')
  .onDelete(async (snap) => {
    const { fromUid, toUid } = snap.data();
    
    await db.runTransaction(async (tx) => {
      const fromRef = db.collection('users').doc(fromUid);
      const toRef = db.collection('users').doc(toUid);
      
      tx.update(fromRef, { 
        followingCount: admin.firestore.FieldValue.increment(-1) 
      });
      tx.update(toRef, { 
        followersCount: admin.firestore.FieldValue.increment(-1) 
      });
    });
  });
```

**Also update firestore.rules**:
```javascript
// Remove client-side counter updates, make them server-only
allow update: if hasAppCheckToken() && (
  (isOwner(userId) && !updateContainsRestrictedFields() && !onlyFieldsChanged(["followersCount", "followingCount"]))
  || isAdmin()
);
```

---

### 2. Missing JSON.parse Error Handling
**Files**: Multiple locations
- `src/services/userSettings.ts` (line 42)
- `src/contexts/cartLogic.ts` (line 17)
- `src/components/map/CreateSpotModal.tsx` (line 121)

**Issue**: `JSON.parse()` can throw if localStorage is corrupted
**Impact**: App crash on load

**Current Code** (userSettings.ts):
```typescript
const parsed = JSON.parse(raw) as Partial<UserSettings>;
```

**Fix**:
```typescript
try {
  const parsed = JSON.parse(raw) as Partial<UserSettings>;
  return { ...DEFAULT_SETTINGS, ...parsed };
} catch (error) {
  console.warn('Failed to parse user settings, using defaults', error);
  localStorage.removeItem(SETTINGS_KEY); // Clear corrupted data
  return DEFAULT_SETTINGS;
}
```

---

### 3. Unchecked Array Access in MapRoute
**File**: `src/pages/MapRoute.tsx`
**Issue**: `filteredPlaces.map(placeToFeature)` can return null, then filtered array may be empty

**Current Code** (line 260):
```typescript
const spotFeatures = useMemo(
  () =>
    filteredPlaces
      .map(placeToFeature)
      .filter(
        (feature): feature is Feature<Point> => feature !== null
      ),
  [filteredPlaces]
);
```

**Issue**: If all places have invalid coordinates, `spotFeatures` is empty array but code may not handle it

**Check for usage** - likely safe but verify map layer updates handle empty arrays

---

## 🟡 HIGH PRIORITY (Fix This Week)

### 4. parseFloat Without Validation
**File**: `src/components/SearchBar.tsx` (lines 35-37, 73-74)

**Issue**: `parseFloat()` returns `NaN` if input is invalid, but code doesn't check

**Current Code**:
```typescript
const lat = parseFloat(parts[0]);
const lng = parseFloat(parts[1]);
if (lat && lng && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
  onCoordinatesSearch([lng, lat]);
}
```

**Problem**: `if (lat)` is false when lat=0 (valid coordinate!)

**Fix**:
```typescript
const lat = parseFloat(parts[0]);
const lng = parseFloat(parts[1]);
if (
  !isNaN(lat) && 
  !isNaN(lng) && 
  lat >= -90 && lat <= 90 && 
  lng >= -180 && lng <= 180
) {
  onCoordinatesSearch([lng, lat]);
}
```

---

### 5. Memory Leak: Missing Cleanup in useEffect
**File**: `src/components/MapView.tsx`

**Issue**: Multiple `useEffect` hooks but some intervals/timeouts may not be cleaned up properly

**Check line 583-616**: Verify all `setInterval`/`setTimeout` are cleared in cleanup

---

### 6. Spot Coordinates Can Be Changed After Approval
**File**: `firestore.rules` (line 663)

**Issue**: User can change lat/lng after spot is approved, potentially misleading others

**Current Code**:
```javascript
allow update: if hasAppCheckToken() && (
  (isSignedIn()
    && resource.data.addedBy == request.auth.uid
    && allowedFields(allowedPlaceFields())
    && isValidPlacePayload())
  || isAdmin()
);
```

**Fix**: Lock coordinates after approval
```javascript
function coordinatesUnchanged() {
  return request.resource.data.lat == resource.data.lat
    && request.resource.data.lng == resource.data.lng;
}

allow update: if hasAppCheckToken() && (
  (isSignedIn()
    && resource.data.addedBy == request.auth.uid
    && (!resource.data.approved || coordinatesUnchanged())  // <-- ADD THIS
    && allowedFields(allowedPlaceFields())
    && isValidPlacePayload())
  || isAdmin()
);
```

---

### 7. Story Expiration Not Enforced on Update
**File**: `firestore.rules` (line 748)

**Issue**: Stories can be updated after they expire (24h)

**Current Code**:
```javascript
allow update: if hasAppCheckToken() && (
  isOwner(resource.data.userId)
  || (isSignedIn() && onlyFieldsChanged(["reactions", "reactionBy"]))
);
```

**Fix**:
```javascript
allow update: if hasAppCheckToken() && (
  (isOwner(resource.data.userId) && request.time < resource.data.expiresAt)
  || (isSignedIn() && onlyFieldsChanged(["reactions", "reactionBy"]))
);
```

---

## 🟢 MEDIUM PRIORITY (Fix Next Sprint)

### 8. Potential Infinite Loop in Username Generation
**File**: `src/services/userProfiles.ts` (line 468)

**Comment says**: `// limit attempts to avoid infinite loop`

**Issue**: If all possible usernames are taken (unlikely but possible), function will loop forever

**Fix**: Add max attempts counter
```typescript
async function generateUsername(uid: string, base: string, maxAttempts = 10): Promise<string> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const candidate = `${base}_${Math.random().toString(36).slice(2, 8)}`;
    if (await isUsernameAvailable(candidate)) {
      return candidate;
    }
    attempts++;
  }
  // Fallback to uid-based username
  return `user_${uid.slice(0, 8)}`;
}
```

---

### 9. Number Coercion in Printful Functions
**File**: `functions/src/index.ts` (line 193)

**Issue**: `Number.parseFloat()` returns `NaN` on invalid input, not checked

**Current Code**:
```typescript
const parsed = Number.parseFloat(normalized);
if (!Number.isFinite(parsed)) return null;  // ✅ GOOD
```

**Status**: Actually safe! Just verify usage.

---

### 10. Missing Default Case in Route Parser
**File**: `src/App.tsx` (lines 200-300)

**Issue**: Complex routing logic, but if malformed paths slip through, may return undefined

**Recommendation**: Add explicit fallback at end of `parseAppRoute()`

---

### 11. Timestamp Conversion Edge Cases
**File**: `src/services/places.ts` (line 91)

**Current Code**:
```typescript
function toMillis(value: unknown): number | undefined {
  if (!value) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}
```

**Issue**: `!value` is true for `0` (valid Unix timestamp)

**Fix**:
```typescript
function toMillis(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}
```

---

## 🔵 LOW PRIORITY (Technical Debt)

### 12. Hardcoded Admin UID in Rules
**File**: `firestore.rules` (line 21)
**Status**: Already flagged in security audit
**Recommendation**: Keep but add IP allowlist for extra security

---

### 13. TODO Comment in AdminDashboard
**File**: `src/pages/AdminDashboard.tsx` (line 2056)
**Content**: `TODO : sync Printful orders here`
**Action**: Implement or remove comment

---

### 14. Temp ID Generation
**File**: `src/pages/AdminDashboard.tsx` (line 2945)
```typescript
const pid = initial?.id || `temp-${Date.now()}`;
```
**Issue**: `Date.now()` can collide if multiple clicks in same millisecond
**Fix**: Use `uuid()` instead

---

### 15. Grid Template Hardcoded Values
**File**: `src/pages/AdminDashboard.tsx` (lines 2115, 2121)
```typescript
gridTemplateColumns: "2fr 1fr 1fr"
```
**Issue**: Not responsive
**Recommendation**: Use CSS classes with media queries

---

## 📊 SUMMARY

| Priority | Count | Should Fix By |
|----------|-------|---------------|
| 🔴 Critical | 3 | Today |
| 🟡 High | 4 | This Week |
| 🟢 Medium | 4 | Next Sprint |
| 🔵 Low | 5 | Backlog |

---

## ✅ GOOD PRACTICES FOUND

1. ✅ **Error boundaries** implemented
2. ✅ **Type guards** used consistently (`filter((x): x is Type => ...)`)
3. ✅ **useMemo/useCallback** used appropriately to prevent re-renders
4. ✅ **Cleanup functions** in most useEffect hooks
5. ✅ **Input validation** before Firestore writes
6. ✅ **Rate limiting** in Firestore rules
7. ✅ **Transaction usage** in some Cloud Functions
8. ✅ **Sanitization** for user HTML content

---

## 🎯 NEXT STEPS

### Immediate (Today):
1. Implement follow counter Cloud Functions
2. Add JSON.parse try-catch wrappers
3. Fix parseFloat validation in SearchBar

### This Week:
4. Lock spot coordinates after approval
5. Enforce story expiration on updates
6. Add max attempts to username generation

### Next Sprint:
7. Audit all useEffect cleanup functions
8. Review route parsing edge cases
9. Fix timestamp conversion for 0 values
10. Replace temp ID with uuid

Would you like me to implement any of these fixes right now?
