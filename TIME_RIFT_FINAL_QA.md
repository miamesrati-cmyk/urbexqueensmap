# 🧪 TIME RIFT FINAL QA - PREVIEW MODE (2 minutes)

**Date**: January 13, 2026  
**Mode**: Production build (no StrictMode doubles)  
**Status**: ✅ Ready for final validation

---

## 🚀 Run Preview Build

```bash
npm run build && npm run preview
# Opens: http://localhost:4173
```

---

## ✅ Test Protocol (2 minutes)

### Test 1: Non-PRO Click → View Chain (45 sec)

```bash
# 1. Clear session storage
sessionStorage.clear();

# 2. Logout (non-PRO mode)
# Manual: Click user menu → Logout

# 3. Navigate to /map
# Manual: Click logo or use console:
window.dispatchEvent(new CustomEvent('urbex-nav', { detail: { path: '/' } }));

# 4. Click TIME RIFT button (map controls, right side)
# Expected console:
[CONVERSION] pro_paywall_open {
  campaign: "time_rift",
  surface: "map_pro_panel",
  userId: null
}

# 5. Auto-redirect to /pro?src=history (glitch animation 300ms)
# Expected console (SINGLE LOG, NO DOUBLES):
[CONVERSION] pro_paywall_view {
  campaign: "time_rift",
  src: "history",
  surface: "pro_landing",
  userId: null
}

# ✅ SUCCESS CRITERIA:
# - Only 1 pro_paywall_open log (no "x2")
# - Only 1 pro_paywall_view log (no "x2")
# - URL bar shows /pro?src=history
```

---

### Test 2: Idempotence (Refresh Protection) (15 sec)

```bash
# Still on /pro?src=history
# 1. Refresh page (F5 or Cmd+R)

# Expected console:
[CONVERSION] Skipped duplicate pro_paywall_view (already tracked this session)

# 2. Navigate away then back to /pro?src=history
# Expected: Still skipped (same session)

# 3. Check session storage:
sessionStorage.getItem("uq_paywall_viewed_/pro?src=history");
// Should return timestamp (e.g., "1705123456789")

# ✅ SUCCESS CRITERIA:
# - Refresh does NOT fire new pro_paywall_view
# - Console shows "Skipped duplicate" message
```

---

### Test 3: Direct Traffic Filter (15 sec)

```bash
# 1. Navigate to /pro WITHOUT ?src= param
window.dispatchEvent(new CustomEvent('urbex-nav', { detail: { path: '/pro' } }));

# Expected console:
[CONVERSION] Skipped pro_paywall_view (src=null, not from campaign)

# OR: No log at all (filtered out)

# ✅ SUCCESS CRITERIA:
# - Direct /pro visits don't pollute campaign stats
# - Only ?src=history (or other campaign sources) tracked
```

---

### Test 4: Funnel Integrity (15 sec)

```javascript
// Check session data:
window.__UQ_CONVERSIONS__

// Expected structure:
[
  {
    event: "pro_paywall_open",
    metadata: {
      campaign: "time_rift",
      surface: "map_pro_panel",
      userId: null
    },
    timestamp: 1705123456789
  },
  {
    event: "pro_paywall_view",
    metadata: {
      campaign: "time_rift",
      src: "history",
      surface: "pro_landing",
      userId: null
    },
    timestamp: 1705123457100
  }
]

// Get aggregated funnel:
getConversionFunnel()
// Expected: { opens: 1, views: 1, starts: 0, successes: 0 }

// ✅ SUCCESS CRITERIA:
// - opens === 1 (single click)
// - views === 1 (single page view)
// - starts === 0 (checkout not wired yet)
// - successes === 0 (checkout not wired yet)
```

---

### Test 5: PRO User - Panel Visibility (30 sec)

```bash
# 1. Login as PRO user
# Manual: Sign in with PRO account

# 2. Navigate to /map
window.dispatchEvent(new CustomEvent('urbex-nav', { detail: { path: '/' } }));

# 3. Click TIME RIFT button
# Expected behavior:
# - Panel appears at bottom center (position:fixed)
# - No redirect (PRO users get feature, not paywall)
# - No conversion events (already PRO)

# 4. Switch modes:
# Click "ARCHIVES" → Sepia tint (rgba(255, 230, 180, 0.10))
# Click "DECAY" → Violet tint (rgba(163, 86, 255, 0.08)) + heatmap
# Click "THEN/NOW" → Blue tint (rgba(100, 150, 255, 0.10))

# Expected: Smooth 180ms fade between tints

# 5. Close panel:
# Click × button OR click TIME RIFT again
# Expected: Panel disappears, overlay clears

# ✅ SUCCESS CRITERIA:
# - Panel visible (not clipped by overflow:hidden)
# - Mode switches have smooth 180ms transition
# - Toggle ON/OFF works cleanly
# - iOS: Panel clears bottom safe-area (iPhone test)
```

---

### Test 6: Checkout Stubs (TODO - Skip for MVP)

```javascript
// When "Subscribe PRO" button clicked:
// Expected: [CONVERSION] pro_checkout_start (when unwired)

// When checkout succeeds:
// Expected: [CONVERSION] pro_checkout_success (when unwired)

// ⚠️ SKIP THIS TEST - Stubs are TODO in:
// - src/services/stripe.ts (commented)
// - src/pages/ProReturnPage.tsx (commented)
```

---

## ✅ Success Checklist

- [ ] **Non-PRO click** → Single `pro_paywall_open` log (no doubles)
- [ ] **Auto-redirect** → Single `pro_paywall_view` log (no doubles)
- [ ] **Refresh /pro** → "Skipped duplicate" console message
- [ ] **Direct /pro** → "not from campaign" skip (or no log)
- [ ] **Funnel stats** → `{ opens: 1, views: 1, starts: 0, successes: 0 }`
- [ ] **PRO user** → Panel visible, smooth 180ms mode transitions
- [ ] **Payload structure** → All events have `campaign: "time_rift"`

---

## ⚠️ Common Issues & Fixes

### Issue: Double logs still appearing
**Cause**: Still in dev mode (`npm run dev`)  
**Fix**: Use `npm run preview` instead (production build)

### Issue: Panel not visible (PRO user)
**Cause**: Overflow clipping or z-index  
**Fix**: Check `position: fixed` + `z-index: 10000` in time-rift.css

### Issue: "Skipped duplicate" on first view
**Cause**: sessionStorage not cleared  
**Fix**: `sessionStorage.clear()` before testing

### Issue: Direct /pro traffic tracked
**Cause**: Old code still tracking `src="direct"`  
**Fix**: Verify ProLandingPage only calls `trackTimeRiftPaywallView(src)` if `src` exists

---

## 📊 Expected Conversion Funnel

```
100 clicks (pro_paywall_open)
  ↓ 80% navigate
 80 views (pro_paywall_view)
  ↓ 25% click Subscribe
 20 starts (pro_checkout_start) [TODO]
  ↓ 25% complete payment
  5 successes (pro_checkout_success) [TODO]

Conversion rate: 5% (click → PRO activation)
```

---

## 🚀 Next Step: Production Export

Once QA passes, uncomment production export:

**Option 1: Firestore (MVP)**
```typescript
// src/utils/conversionTracking.ts
if (import.meta.env.VITE_ENABLE_PROD_CONVERSIONS) {
  const callable = httpsCallable(functions, "logConversion");
  await callable({ event, metadata }).catch(console.warn);
}
```

**Option 2: Firebase Analytics**
```typescript
import { logEvent } from "firebase/analytics";
logEvent(analytics, event, metadata);
```

**Option 3: PostHog**
```typescript
import posthog from "posthog-js";
posthog.capture(event, metadata);
```

---

## ✅ Ready to Ship?

If all tests pass:

```bash
git add -A
git commit -m "feat(time-rift): production-grade conversion tracking (idempotent + filtered)"
git push

# Deploy
npm run build
firebase deploy --only hosting
```

**TIME RIFT MVP is production-ready!** 🚀🕰️

---

**Last Updated**: January 13, 2026  
**Build Status**: ✓ 1344 modules, 13.11s  
**QA Status**: ⏳ Awaiting 2-minute preview test
