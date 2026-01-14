# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Playwright E2E

Automated tests target the Vite preview server so they exercise the last build artifact. Run them with:

```
npx playwright test --trace on
```

If binding to the default loopback port fails with `listen EPERM`, rerun the command with the `E2E_PORT` environment variable set to a permitted port (e.g., `4174` or `3001`) so Playwright and Vite use the same host/port:

```
E2E_PORT=4174 npx playwright test --trace on
```

The configuration already does `npm run build && npm run preview -- --host 0.0.0.0 --port ${E2E_PORT||4173} --strictPort`, so the preview server always starts on the port you request and Playwright’s `baseURL`/`webServer.url` follow through.

### QA hooks require build-time flags
Tests expect the QA helpers to mount the `auth-modal` dialog and `reload-banner`, but Vite inlines `import.meta.env` values at build time. Always enable `VITE_ENABLE_E2E_HOOKS=1` for the whole QA flow:

```
VITE_ENABLE_E2E_HOOKS=1 npm run build
VITE_ENABLE_E2E_HOOKS=1 npm run preview -- --host 127.0.0.1 --port 5183 --strictPort
E2E_BASE_URL=http://127.0.0.1:5183 npx playwright test --trace on
```

The preview server reports `"[UQ] QA reload hooks enabled (VITE_ENABLE_E2E_HOOKS=1)"` in the browser console when the flag is active, so you can verify the deterministic hooks are running before the Playwright run.

## Required GitHub Secrets

The strict `main`/`tags` build injects production credentials so Vite can inline the same runtime secrets used in production. The workflow named `strict-build` (`.github/workflows/ci.yml`) fails unless each secret is populated:

| Secret | Description | Usage |
| --- | --- | --- |
| `VITE_MAPBOX_TOKEN` | Mapbox public token for rendering the OpenStreetMap-derived tile layers (`src/lib/map*`, `src/components/MapBase.tsx`). | Inlined during build so `mapboxgl` can fetch tiles. |
| `VITE_FIREBASE_API_KEY` | Firebase client API key (`src/lib/firebase.ts`). | Needed for Firebase initialization during build-time env validation. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier. | Used in Firebase URLs (Firestore, Storage, App Check, Admin dashboard links). |
| `VITE_FIREBASE_APP_ID` | Firebase App ID. | Required for Firebase + App Check client setup and env validation heuristics. |

If any secret is missing, the strict build exits early with a clear message so the CI failure surfaces directly in the checks list.

## Environment tiers & validation

- Local development relies on `.env.local`, which stores only public-facing `VITE_*` tokens (Mapbox, Firebase, Stripe publishable key, etc.) and is ignored by git so the values never leak (`.gitignore:15`). That lets every dev keep their overrides without affecting the repo or tracking private keys.
- Production builds (and the strict CI run) pull the same `VITE_*` secrets from the workflow table above. `src/utils/validateEnv.ts:32` runs during bootstrap and checks that `VITE_MAPBOX_TOKEN` is present and starts with `pk.` (`src/utils/validateEnv.ts:56`) along with the Firebase identifiers, throwing immediately in `import.meta.env.DEV` but only logging/capturing and rendering `ConfigErrorScreen` when a build is missing values (`src/main.tsx:93`, `src/main.tsx:155`, `src/components/ConfigErrorScreen.tsx:12`), so a misconfiguration never crashes the production bundle.
- Any real secret material (Stripe secret/webhook keys, price IDs, `OPENWEATHER_API_KEY`, database credentials, etc.) stays inside Firebase Cloud Functions config (`functions/src/index.ts:37`). The client only ever reads publishable tokens such as `VITE_STRIPE_PUBLIC_KEY` when calling `loadStripe` (`src/lib/stripeClient.ts:5`), so no `sk_live_` credential is referenced from `src/` and all sensitive API keys remain server-side.

## CSP reporting & enforcement

- The app now injects CSP directives via an inline script in `index.html`, so you can toggle enforcement without rebuilding the header definitions. Set `VITE_ENFORCE_CSP=1` during the build to switch the meta tag to `Content-Security-Policy` with the same directives, while the default remains report-only.
- Use `VITE_CSP_STRICT_NO_EVAL=1` to drop `'unsafe-eval'` from the script-src directive when you are ready to validate that removal (the CSP script keeps `'unsafe-inline'` for now to avoid breaking the app).
- CSP reports are collected by the new Cloud Function `cspReport` (`functions/src/index.ts`), which deduplicates on `violatedDirective|blockedURI|sourceFile`, samples at the rate controlled via `CSP_REPORT_SAMPLE_RATE` (default `0.1`), and shuffles older keys out after `CSP_REPORT_HISTORY_LIMIT` entries (default `200`). Sentry already records every filtered report and the endpoint returns `204`.
- When the report deck looks clean, flip `VITE_ENFORCE_CSP=1` during the strict build and swap the Firebase header to the enforced `Content-Security-Policy` version (the header stays in report-only mode until that manual change).

## Playwright gating

- The test job’s Vitest step still continues on branches/PRs but becomes blocking on `main`/`tags` runs so type errors fail fast. Playwright remains soft-gated everywhere for now, but you can flip the `PLAYWRIGHT_BLOCKING` environment variable to `1` if you want to enforce it once stability is proven.
- Playwright builds retry once on failure and the failed run uploads the `playwright-report` directory via `actions/upload-artifact` so you can inspect traces/videos from the check run.
- Keep `VITE_ENABLE_E2E_HOOKS=1` when running Playwright locally so the QA helpers our tests rely on are present.
