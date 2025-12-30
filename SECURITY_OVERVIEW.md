# Security Overview

### What's protected
- **Authentication & App Check**: Firestore, Storage, and Callable Functions require App Check (reCAPTCHA v3) when `VITE_FIREBASE_APP_CHECK_SITE_KEY` is provided. Missing prod keys trigger the `SecurityLockOverlay` and `ensureWritesAllowed()` so no write-capable UI is available until App Check tokens arrive.
- **Firestore & Storage**: Rules enforce least-privilege with App Check gating, ownership checks, schema validations, field allowlists, length/size/cap limits, and a strict content-type/size policy on Storage trees (avatars, posts, stories, DMs, spot/history/media uploads); Firestore writes now trigger sanitization for user content while Storage blocks SVG/HTML by only allowing JPEG/PNG/WEBP and MP4 plus a guarded listing policy.
- **Cloud Functions**: Callable endpoints now validate payloads via `zod`, require App Check, enforce per-uid/IP `enforceRateLimit`, sanitize/normalize user content before persisting, log structured security events (`functions.logger`, `securityEvents` collection), and quarantine unsupported media with Sharp + logging/quarantine buckets.
- **Hosting & CSP**: Firebase Hosting now returns `Content-Security-Policy` (default self + required Mapbox/Firebase/Stripe sources), `X-Frame-Options: DENY`, expanded `Permissions-Policy`, plus HSTS/referrer/nosniff headers for anti-clickjacking and transport security.
- **Observation pipeline**: Security events cover missing App Check, quarantine actions, sanitized writes, uploads, and rate-limit flags. Each entry includes structured metadata so the Cloud Monitoring metric filter on `securityEvents` (severity ≥ warning) can power alert policies and dashboards.

### How to test
1. **Manual rules validation**: Use Firebase Emulator (Firestore + Storage) to confirm App Check gating and schema enforcement by attempting unauthorized writes (e.g., missing `appCheck` or owner mismatch). Pay special attention to `users`, `places`, `posts`, `stories`, `conversations`, `userPlaces`, and `userSettings`.
2. **`npm run build`**: Ensures TypeScript + Vite work with the new imports (App Check, DOMPurify, `sharp` pipeline).
3. **Hosting headers**: Use `curl -I https://[prod].web.app` (or Firebase hosting preview) to check CSP, Permissions, HSTS, Referrer, and X-Frame headers match `firebase.json`.
4. **Functions**: Deploy and trigger callable functions with/without App Check tokens to verify guards/logging and the quarantine flow for Storage uploads (requires Cloud Function + Storage triggers).
5. **Security events & sanitization**: Use the emulator to write crafted captions/bios (e.g., script-heavy `historyShortHtml`, `location.label`, `comment.text`) and verify the sanitization triggers clean the fields while `securityEvents` receives the matching warning/rate-limit/quarantine log that the metric filter picks up.

### Remaining risks / Next steps
- **App Check rollout**: Ensure `VITE_FIREBASE_APP_CHECK_SITE_KEY` is configured for every environment (prod + staging); until then App Check won’t block requests. Consider reCAPTCHA Enterprise for stricter bot defense.
- **Rate limiting / anti-abuse**: `enforceRateLimit`, Firestore schema caps, and `ensureWritesAllowed` reduce amplification, but consider additional backend throttles (per IP/UID event backoff) for abuse campaigns.
- **Alerting**: Security event logs now feed a Cloud Monitoring metric filter (severity ≥ warning) and alert policy; ensure the policy is enabled with the right notification channel so spikes in App Check failures, quarantines, or rate-limit hits trigger ops awareness.
- **Secrets**: Continue auditing that no secrets (Stripe/admin keys) leak into frontend builds; rely on `functions.config()` and server-side storage.
- **Media pipeline**: Sharp runs on uploads; make sure the quarantine bucket (configurable via `security.quarantine_bucket`) exists to avoid losing flagged files.
