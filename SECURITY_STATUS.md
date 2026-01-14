## SECURITY STATUS

| Area | Status | Notes |
| --- | --- | --- |
| Auth | ✅ App Check + Firebase Auth | App Check (reCAPTCHA v3) wired via `VITE_FIREBASE_APP_CHECK_SITE_KEY`; missing prod keys trigger `SecurityLockOverlay` + `ensureWritesAllowed()` so write-capable UI is disabled until App Check is configured. |
| Firestore rules | ✅ Hardened | Added App Check gating, strict field allowlists/validators, length caps, admin-only namespaces, doc ownership enforcement, and schema helpers for users, places, posts, stories, conversations, settings, and user place buckets. |
| Storage rules | ✅ Hardened | All uploads/auth writes require App Check; allowed content types limited to JPEG/PNG/WEBP + MP4, listing disabled for public buckets, and `sanitizeMediaUpload` re-encodes media + spikes dangerous files into the configured `security.quarantine_bucket`. |
| Firebase Functions | ✅ Validations & logging | Callable handlers require App Check, run `enforceRateLimit`, sanitize/normalize payloads before writes plus log structured events into `securityEvents`, and the media pipeline logs quarantine/processing outcomes. |
| Hosting headers | ⚠️ CSP report-only | `Content-Security-Policy-Report-Only` now mirrors the strict policy (default self + required bundles, `unsafe-eval` removed). Use `firebase.csp.enforced.json` to flip on enforcement once Sentry `feature=csp` telemetry stays clean for 24–72h. |
| Logging & alerts | ⚠️ Partial | Security events (missing App Check, quarantine, rate-limit triggers) land in `securityEvents` and feed a metric filter / alert policy targeting severity ≥ warning; enable your preferred notification channel in Cloud Monitoring. |
| Rate limits / anti-abuse | ✅ Guarded | Callables use `enforceRateLimit` (per uid+IP), Firestore writes guard via `ensureWritesAllowed`, and schema checks plus deduplication throttles spot/post submissions. |

### Sensitive Endpoints

- Submit spot (Firestore `places` writes + Storage uploads).
- Upload media (Storage `posts`, `stories`, `avatars`, `historyImages`).
- Profile edit (Firestore `users/{uid}` + `userSettings` writes).
- Feed post creation (Firestore `posts`, `posts/{postId}/comments` writes).
- Admin actions (Firestore `admins`, `placeHistoryEdits`, Cloud Functions admin routes).

App Check now protects each of these via Firestore rules and Functions guards.

### Checklist toggles
- **App Check enforced** – ✅ Missing `VITE_FIREBASE_APP_CHECK_SITE_KEY` in PROD disables writes and App Check tokens are required by Firestore/Storage/Functions rules. Production builds set `VITE_REQUIRE_APP_CHECK=1`, and local runs can opt into `VITE_APP_CHECK_DEBUG=1` for the debug provider.
- **Quarantine bucket configured** – ✅ `sanitizeMediaUpload` copies suspicious uploads into `functions.config().security.quarantine_bucket`; ensure the bucket exists and is monitored.
- **Alert policy configured** – ⚠️ A metric filter on `securityEvents` severity ≥ warning is ready; link it to a Cloud Monitoring alert channel for real-time notification.
