# 🧪 TIME RIFT CONVERSION TRACKING - QA CHECKLIST

**Date**: January 13, 2026  
**Status**: ✅ Idempotent + Unified Payloads

---

## ✅ Critical Fixes Applied

### 1. **Idempotence Guard** (No Double-Counting)
```typescript
// src/utils/conversionTracking.ts
export function trackTimeRiftPaywallView(src: string, userId?: string | null) {
  // ✅ sessionStorage guard prevents double-counting
  const storageKey = `uq_paywall_viewed_${src}`;
  if (sessionStorage.getItem(storageKey)) {
    return; // Skip if already tracked this session
  }
  sessionStorage.setItem(storageKey, Date.now().toString());
  // ... track event ...
}
```

**Result**: StrictMode + useEffect rerender won't duplicate events

---

### 2. **Unified Payload Structure** (Aggregatable)
```typescript
// Old (inconsistent):
{ source: "time_rift" }   // Click
{ source: "history" }      // View (from URL)

// New (consistent):
{
  campaign: "time_rift",   // ✅ Stable identifier for dashboards
  src: "history",          // ✅ Raw query param for attribution
  surface: "map_pro_panel" // ✅ UI surface context
}
```

**Result**: Easy to aggregate/filter in analytics dashboards

---

### 3. **Production Reality Check** (TODO Warnings)
```typescript
/**
 * TODO: PRODUCTION EXPORT REQUIRED
 * - Option 1: Firebase Analytics (logEvent)
 * - Option 2: PostHog (posthog.capture)
 * - Option 3: Cloud Function endpoint (fetch /api/track)
 * - Option 4: GTM dataLayer.push
 * 
 * Current: Debug only (sessionStorage + console)
 * This does NOT provide production metrics/aggregation.
 */
```

**Result**: Clear expectation that current implementation is debug-only

---

## 🧪 Test Protocol (2 minutes)

### Test 1: Non-PRO Click → View Chain
```bash
# 1. Clear sessionStorage
sessionStorage.clear();

# 2. Logout (non-PRO mode)
await window.__UQ_QA__.logout();

# 3. Navigate to /map
window.dispatchEvent(new CustomEvent('urbex-nav', { detail: { path: '/' } }));

# 4. Click TIME RIFT button
# Expected console:
[CONVERSION] pro_paywall_open {
  campaign: "time_rift",
  surface: "map_pro_panel",
  userId: null
}

# 5. Auto-redirect to /pro?src=history
# Expected console (ONCE, not twice):
[CONVERSION] pro_paywall_view {
  campaign: "time_rift",
  src: "history",
  surface: "pro_landing",
  userId: null
}
```

### Test 2: Idempotence (No Double-Count)
```bash
# 1. Already on /pro?src=history
# 2. Refresh page (F5)
# Expected console:
[CONVERSION] Skipped duplicate pro_paywall_view (already tracked this session)

# 3. Navigate away + back to /pro?src=history
# Expected: Still skipped (same session)

# 4. Close tab + reopen (new session)
# Expected: New pro_paywall_view tracked
```

### Test 3: Funnel Stats
```javascript
// Check session data:
window.__UQ_CONVERSIONS__
// Expected array:
[
  {
    event: "pro_paywall_open",
    metadata: { campaign: "time_rift", surface: "map_pro_panel", ... },
    timestamp: 1705123456789
  },
  {
    event: "pro_paywall_view",
    metadata: { campaign: "time_rift", src: "history", surface: "pro_landing", ... },
    timestamp: 1705123457100
  }
]

// Get aggregated stats:
getConversionFunnel()
// Expected: { opens: 1, views: 1, starts: 0, successes: 0 }
```

### Test 4: Production Build (No StrictMode)
```bash
npm run build && npm run preview

# Navigate to http://localhost:4173
# Repeat Test 1
# Expected: Single logs only (no "x2" duplicates)
```

---

## 📊 Payload Validation

### Expected Event Structure

#### pro_paywall_open (Non-PRO click TIME RIFT)
```javascript
{
  event: "pro_paywall_open",
  metadata: {
    campaign: "time_rift",    // Stable campaign ID
    surface: "map_pro_panel", // UI surface
    userId: null              // Not logged in
  },
  timestamp: 1705123456789
}
```

#### pro_paywall_view (/pro?src=history)
```javascript
{
  event: "pro_paywall_view",
  metadata: {
    campaign: "time_rift",   // Stable campaign ID
    src: "history",          // Raw query param
    surface: "pro_landing",  // UI surface
    userId: "abc123"         // If logged in
  },
  timestamp: 1705123457100
}
```

#### pro_checkout_start (TODO: Wire in stripe.ts)
```javascript
{
  event: "pro_checkout_start",
  metadata: {
    campaign: "time_rift",
    src: "history",
    surface: "checkout_button",
    plan: "pro_monthly",
    userId: "abc123"
  },
  timestamp: 1705123458000
}
```

#### pro_checkout_success (TODO: Wire in ProReturnPage)
```javascript
{
  event: "pro_checkout_success",
  metadata: {
    campaign: "time_rift",
    src: "history",
    surface: "checkout_success",
    plan: "pro_monthly",
    value: 9.99,
    userId: "abc123"
  },
  timestamp: 1705123460000
}
```

---

## ✅ Success Criteria

- [ ] **Idempotence**: Refresh /pro?src=history → No duplicate `pro_paywall_view`
- [ ] **Payload consistency**: All events use `campaign: "time_rift"` + `src: "history"`
- [ ] **No doubles in preview**: `npm run preview` → Single logs only
- [ ] **Funnel integrity**: `opens` ≥ `views` ≥ `starts` ≥ `successes`
- [ ] **TODO visibility**: Clear warnings about debug-only implementation

---

## 🚀 Next Steps (Production)

### 1. Choose Export Provider
```typescript
// Option 1: Firebase Analytics
import { logEvent } from "firebase/analytics";
import { analytics } from "../lib/firebase";

export function trackConversion(event, metadata) {
  logEvent(analytics, event, metadata);
  // ... existing debug code ...
}
```

### 2. Wire Checkout Events
- [ ] `src/services/stripe.ts` → Uncomment `trackCheckoutStart()`
- [ ] `src/pages/ProReturnPage.tsx` → Uncomment `trackCheckoutSuccess()`

### 3. Dashboard Setup
- Firebase Analytics: Enable `pro_paywall_*` custom events
- PostHog: Create funnel visualization (Open → View → Start → Success)
- Cloud Monitoring: Alert on conversion rate drops

### 4. Validate Metrics
- Baseline: 48h of tracking
- Expected funnel: 100 opens → 80 views → 20 starts → 5 successes
- Alert triggers: <50% open→view, <10% view→start, <20% start→success

---

## 📁 Files Modified

| File | Changes | Status |
|------|---------|--------|
| `src/utils/conversionTracking.ts` | Added idempotence guard + unified payloads + TODO warnings | ✅ FIXED |
| `src/pages/ProLandingPage.tsx` | Updated to use idempotent tracking + comment clarification | ✅ FIXED |
| `src/services/stripe.ts` | Added TODO stub for `trackCheckoutStart()` | ✅ READY |
| `src/pages/ProReturnPage.tsx` | Added TODO stub for `trackCheckoutSuccess()` | ✅ READY |

---

## 🔒 Zero-Data Compliance

- ✅ No Firestore writes
- ✅ sessionStorage only (clears on tab close)
- ✅ Console logs in dev only
- ✅ No external API calls (Firebase Analytics commented)
- ✅ GDPR-friendly (ephemeral session storage)

---

## ⚠️ Known Limitations

1. **Debug-only**: Current implementation does NOT send data to analytics platforms
2. **Session-scoped**: Funnel stats reset on page refresh (by design)
3. **No cross-device tracking**: sessionStorage is tab-specific
4. **Manual aggregation**: Need to export to analytics platform for dashboards

**These are acceptable for MVP launch** - production export can be enabled in 1 line when ready.

---

**Build Status**: ✅ `✓ 1344 modules, 13.07s`  
**QA Status**: ⏳ Awaiting 2-minute test protocol  
**Production Ready**: ⚠️ Debug mode only (export provider required for metrics)
