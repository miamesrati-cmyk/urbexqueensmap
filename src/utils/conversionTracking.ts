/**
 * Lightweight Conversion Tracking for TIME RIFT → PRO funnel
 * 
 * Zero-data, minimal overhead, console-only in dev
 * Ready for Firebase Analytics / GTM / PostHog integration
 */

type ConversionEvent = 
  | "pro_paywall_open"
  | "pro_paywall_view"
  | "pro_checkout_start"
  | "pro_checkout_success";

type EventMetadata = {
  campaign?: string;      // Stable campaign identifier (e.g., "time_rift")
  src?: string;           // Raw query param (e.g., "history")
  surface?: string;       // UI surface (e.g., "map_pro_panel")
  userId?: string | null;
  plan?: string;
  value?: number;
  [key: string]: unknown;
};

/**
 * Track conversion event - currently logs to console in dev
 * 
 * ═══════════════════════════════════════════════════════════════
 * TODO: PRODUCTION EXPORT REQUIRED FOR REAL METRICS
 * ═══════════════════════════════════════════════════════════════
 * 
 * Current status: Debug only (sessionStorage + console)
 * This does NOT provide production aggregation/dashboards.
 * 
 * ─────────────────────────────────────────────────────────────
 * OPTION 1: Firestore Analytics Log (MVP, 0 extra infra)
 * ─────────────────────────────────────────────────────────────
 * 
 * **CRITICAL: Use aggregatable schema to avoid write spam + cost explosion**
 * 
 * Strategy A: Daily Counters (Recommended, cheapest, dashboard-ready)
 * 
 * 1. Create Cloud Function (callable):
 *    ```typescript
 *    import { increment, FieldValue } from "firebase-admin/firestore";
 *    
 *    export const logConversion = onCall(async (request) => {
 *      const { event, campaign, src, surface } = request.data.metadata;
 *      const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
 *      
 *      const aggregateKey = `${event}_${campaign}_${src}_${surface}`;
 *      const docRef = db
 *        .collection("analytics_daily")
 *        .doc(date)
 *        .collection("counters")
 *        .doc(aggregateKey);
 *      
 *      await docRef.set({
 *        event,
 *        campaign,
 *        src,
 *        surface,
 *        count: FieldValue.increment(1),
 *        lastUpdated: FieldValue.serverTimestamp(),
 *      }, { merge: true });
 *    });
 *    ```
 * 
 * 2. Query for funnel (cheap, fast):
 *    ```typescript
 *    const snapshot = await db
 *      .collection("analytics_daily/2026-01-14/counters")
 *      .get();
 *    const funnel = {};
 *    snapshot.forEach(doc => {
 *      const { event, count } = doc.data();
 *      funnel[event] = (funnel[event] || 0) + count;
 *    });
 *    // Result: { pro_paywall_open: 42, pro_paywall_view: 35, ... }
 *    ```
 * 
 * Strategy B: Raw Events with Deduplication (more flexible, higher cost)
 * 
 * 1. Cloud Function with dedupe key:
 *    ```typescript
 *    export const logConversion = onCall(async (request) => {
 *      const { event, metadata } = request.data;
 *      const { userId, canonicalPath } = metadata;
 *      
 *      // Dedupe: event + user + path (prevents double-counting)
 *      const dedupeKey = `${event}_${userId}_${canonicalPath.replace(/\//g, "_")}`;
 *      
 *      await db.collection("analytics_events").doc(dedupeKey).set({
 *        event,
 *        ...metadata,
 *        timestamp: FieldValue.serverTimestamp(),
 *      });
 *    });
 *    ```
 * 
 * 3. Wire here:
 *    ```typescript
 *    if (import.meta.env.VITE_ENABLE_PROD_CONVERSIONS) {
 *      const callable = httpsCallable(functions, "logConversion");
 *      await callable({ event, metadata }).catch(console.warn);
 *    }
 *    ```
 * 
 * ✅ Pros: Get real numbers TODAY, aggregates avoid cost explosion
 * ⚠️  Cons: Manual funnel viz (but counters make it trivial)
 * 
 * ─────────────────────────────────────────────────────────────
 * OPTION 2: Firebase Analytics (Google-native)
 * ─────────────────────────────────────────────────────────────
 * 
 * ```typescript
 * import { logEvent } from "firebase/analytics";
 * import { analytics } from "../lib/firebase";
 * 
 * export function trackConversion(event, metadata) {
 *   logEvent(analytics, event, metadata);
 * }
 * ```
 * 
 * ✅ Pros: Native Firebase integration, free tier generous
 * ⚠️  Cons: 24h delay for reports, limited custom events
 * 
 * ─────────────────────────────────────────────────────────────
 * OPTION 3: PostHog (Best for funnels/heatmaps)
 * ─────────────────────────────────────────────────────────────
 * 
 * ```typescript
 * import posthog from "posthog-js";
 * 
 * export function trackConversion(event, metadata) {
 *   posthog.capture(event, metadata);
 * }
 * ```
 * 
 * ✅ Pros: Real-time funnels, session replay, free tier 1M events
 * ⚠️  Cons: External dependency, GDPR considerations
 * 
 * ─────────────────────────────────────────────────────────────
 * OPTION 4: GTM dataLayer (Flexible)
 * ─────────────────────────────────────────────────────────────
 * 
 * ```typescript
 * export function trackConversion(event, metadata) {
 *   window.dataLayer?.push({ event, ...metadata });
 * }
 * ```
 * 
 * ✅ Pros: Route to any analytics (GA4, Mixpanel, etc.)
 * ⚠️  Cons: Requires GTM setup, more complex
 * 
 * ═══════════════════════════════════════════════════════════════
 */
export function trackConversion(
  event: ConversionEvent,
  metadata?: EventMetadata
) {
  // Console log in dev for debugging
  if (import.meta.env.DEV) {
    console.log(`[CONVERSION] ${event}`, metadata || {});
  }

  // TODO: UNCOMMENT WHEN READY FOR PRODUCTION METRICS
  // import { logEvent } from "firebase/analytics";
  // import { analytics } from "../lib/firebase";
  // logEvent(analytics, event, metadata);

  // Store for session analytics (debug only, not production-ready)
  if (typeof window !== "undefined") {
    const conversions = (window as any).__UQ_CONVERSIONS__ || [];
    conversions.push({
      event,
      metadata,
      timestamp: Date.now(),
    });
    (window as any).__UQ_CONVERSIONS__ = conversions;
  }
}

/**
 * Track TIME RIFT button click (non-PRO → paywall)
 * Campaign-specific surface: map_pro_panel
 */
export function trackTimeRiftPaywallOpen(userId?: string | null) {
  trackConversion("pro_paywall_open", {
    campaign: "time_rift",    // Stable identifier for dashboards
    src: "history",           // Campaign source
    surface: "map_pro_panel", // Where the click happened
    userId,
  });
}

/**
 * Track PRO paywall open from internal surfaces (non-campaign)
 * Use for: menu, header, settings, profile, etc.
 * Complements trackTimeRiftPaywallOpen (campaign-specific)
 * 
 * Example:
 *   trackProPaywallOpen("menu", uid)
 *   trackProPaywallOpen("settings", uid)
 * 
 * @param surface - Internal surface identifier
 * @param userId - Current user ID (optional)
 */
export function trackProPaywallOpen(
  surface: string,
  userId?: string | null
) {
  trackConversion("pro_paywall_open", {
    campaign: "internal",     // Not from external campaign
    src: surface,             // Use surface as source
    surface,                  // Keep surface for consistency
    userId,
  });
}

/**
 * Canonicalize URL query params for idempotence
 * 
 * - Whitelists only campaign-relevant params (src, variant, surface)
 * - Sorts alphabetically to handle param order variations
 * - Drops UTM noise (utm_*, fbclid, gclid, etc.)
 * 
 * Example:
 *   /pro?variant=a&src=history&utm_source=x
 *   → /pro?src=history&variant=a
 */
function canonicalizeQueryParams(search: string): string {
  const params = new URLSearchParams(search);
  const whitelist = ["src", "variant", "surface"]; // Campaign-relevant only
  
  const canonical = new URLSearchParams();
  whitelist.forEach((key) => {
    const value = params.get(key);
    if (value) {
      canonical.set(key, value);
    }
  });
  
  // Sort alphabetically for consistency
  const sorted = Array.from(canonical.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  
  return sorted ? `?${sorted}` : "";
}

/**
 * Track /pro page view from TIME RIFT redirect
 * Idempotent: Uses sessionStorage with canonicalized path to prevent double-counting
 * 
 * @param src - Raw query param (e.g., "history", "direct")
 * @param userId - Current user ID (optional)
 */
export function trackTimeRiftPaywallView(
  src: string,
  userId?: string | null
) {
  // Filter out non-campaign traffic (direct visits without ?src=)
  // Only track if src exists (campaign attribution required)
  if (!src || src === "direct") {
    if (import.meta.env.DEV) {
      console.log(`[CONVERSION] Skipped pro_paywall_view (src=${src}, not from campaign)`);
    }
    return;
  }

  // Idempotence guard: Track once per session per CANONICAL path
  // Canonicalization handles:
  // - Param order: ?src=history&variant=a === ?variant=a&src=history
  // - UTM noise: ?src=history&utm_source=x === ?src=history
  const canonicalSearch = canonicalizeQueryParams(window.location.search);
  const canonicalPath = window.location.pathname + canonicalSearch;
  const storageKey = `uq_paywall_viewed_${canonicalPath}`;
  
  if (typeof sessionStorage !== "undefined") {
    if (sessionStorage.getItem(storageKey)) {
      if (import.meta.env.DEV) {
        console.log(`[CONVERSION] Skipped duplicate pro_paywall_view (already tracked this session)`);
      }
      return;
    }
    sessionStorage.setItem(storageKey, Date.now().toString());
  }

  trackConversion("pro_paywall_view", {
    campaign: "time_rift",    // Stable identifier
    src,                      // Raw param for attribution
    surface: "pro_landing",   // Where the view happened
    userId,
  });
}

/**
 * Track checkout start (Stripe session creation)
 * Captures campaign attribution + plan details
 * 
 * @param plan - Plan identifier (e.g., "monthly", "yearly")
 * @param src - Campaign source (from URL params, e.g., "history")
 * @param userId - Current user ID (optional)
 * 
 * TODO: Wire this in src/services/stripe.ts startProCheckout()
 * Example:
 *   const searchParams = new URLSearchParams(window.location.search);
 *   trackCheckoutStart(plan, searchParams.get("src") || undefined, user?.uid);
 */
export function trackCheckoutStart(
  plan: string,
  src?: string,
  userId?: string | null
) {
  // Preserve campaign attribution if src exists
  const campaign = src === "history" ? "time_rift" : src ? "other" : "internal";
  
  trackConversion("pro_checkout_start", {
    campaign,
    src: src || "direct",
    surface: "checkout_button",
    plan,
    userId,
  });
}

/**
 * Track successful conversion (PRO activated)
 * Final funnel step - revenue event
 * 
 * @param plan - Plan identifier (e.g., "monthly", "yearly")
 * @param value - Revenue amount in cents (e.g., 599 for $5.99)
 * @param src - Campaign source (from URL params or session)
 * @param userId - Current user ID (required for revenue attribution)
 * 
 * TODO: Wire this in:
 * - src/pages/ProReturnPage.tsx (success state, store src in session on checkout)
 * - functions/src/index.ts (webhook confirmed, read src from Stripe metadata)
 * 
 * Example (ProReturnPage):
 *   const src = sessionStorage.getItem("checkout_src") || undefined;
 *   trackCheckoutSuccess(plan, 599, src, user?.uid);
 */
export function trackCheckoutSuccess(
  plan: string,
  value: number,
  src?: string,
  userId?: string | null
) {
  // Preserve campaign attribution if src exists
  const campaign = src === "history" ? "time_rift" : src ? "other" : "internal";
  
  trackConversion("pro_checkout_success", {
    campaign,
    src: src || "direct",
    surface: "checkout_success",
    plan,
    value,
    userId,
  });
}

/**
 * Get conversion funnel stats for current session (debug only)
 */
export function getConversionFunnel(): {
  opens: number;
  views: number;
  starts: number;
  successes: number;
} {
  if (typeof window === "undefined") {
    return { opens: 0, views: 0, starts: 0, successes: 0 };
  }

  const conversions = (window as any).__UQ_CONVERSIONS__ || [];
  return {
    opens: conversions.filter((c: any) => c.event === "pro_paywall_open").length,
    views: conversions.filter((c: any) => c.event === "pro_paywall_view").length,
    starts: conversions.filter((c: any) => c.event === "pro_checkout_start").length,
    successes: conversions.filter((c: any) => c.event === "pro_checkout_success").length,
  };
}
