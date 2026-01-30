# Copilot Instructions for UrbanExplorationQueensMap

## Project Overview

This is a React + TypeScript + Vite single-page application that visualizes and manages urban exploration ("urbex") spots on a Mapbox map with Firebase Firestore as the backend. The app includes user authentication, real-time data synchronization, map clustering, and Pro subscription features via Stripe.

**Key Features:**
- Interactive Mapbox GL JS map with custom markers and clustering
- Firebase Authentication (Google Sign-In)
- Real-time Firestore data synchronization
- User roles: Regular users, Pro subscribers, and Admins
- PWA support with offline capabilities
- Stripe payment integration for Pro subscriptions
- Security rules and CSP enforcement

## Quick Orientation for AI Coding Agents

The guidance below points to the concrete files and patterns an agent should use when modifying or extending the project.

- Project root: `package.json` (scripts: `dev`, `build`, `preview`, `lint`). Use `npm run dev` to start the app locally.
- Compiler / bundler: Vite (`vite.config.ts`). Environment variables use `import.meta.env` and must be prefixed with `VITE_`.

Core integrations
- Map rendering: `mapbox-gl` is used. Map container components:
  - `src/components/MapView.tsx` — primary map UI used by the app.
  - `src/components/MapBase.tsx` — a minimal Mapbox example used for debugging/logging.
  Mapbox CSS is imported once in `src/main.tsx` (`import "mapbox-gl/dist/mapbox-gl.css"`).
  Env key: `VITE_MAPBOX_TOKEN` (check `.env` in your environment). `MapBase` prints a masked token prefix in console for quick debug.

- Firebase: configured in `src/lib/firebase.ts`. Exports:
  - `app`, `db`, `auth`, `provider` — initialized Firebase objects.
  - `signInGoogle()` — sign-in helper.
  - `watchAuth(cb)` — attaches an onAuthStateChanged listener and calls back with `uid | null`.

- Firestore model & API: `src/services/places.ts`.
  - Type `Place` is defined there along with helpers:
    - `listenPlaces(cb: (p: Place[]) => void)` — subscribes to `places` collection using `onSnapshot` and returns an unsubscribe function.
    - `createPlace(input: Omit<Place, "id" | "createdAt">)` — creates a place using `uuid()` for `id` and `serverTimestamp()` for `createdAt`.
  - Note: `listenPlaces` converts Firestore timestamps to milliseconds (uses `toMillis()` when available).

UI conventions and patterns
- Functional React + TypeScript. Components live under `src/components/` and are small and self-contained (e.g., `AddPlaceForm.tsx` is a self-contained modal form).
- Styling: lightweight CSS files in `src/` (`styles.css`, `App.css`, `index.css`). Map containers use `.map-container` class.
- Strings and labels are in French in many components — preserve locale when modifying UI copy.

Important developer workflows
- Dev server: `npm run dev` — uses Vite HMR.
- Build: `npm run build` (runs `tsc -b` then `vite build`). Preview a build with `npm run preview`.
- Linting: `npm run lint` (ESLint is configured via `eslint.config.js`).

Environment and secrets
- Required env variables (prefix with `VITE_`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_MAPBOX_TOKEN`.
- The app reads them via `import.meta.env.VITE_...`. Do not hardcode keys. For local development, put them in a `.env` file at the repo root (not checked in).

Examples (copy-paste safe)
- Listen to places in a component:
  import { listenPlaces } from "src/services/places";
  useEffect(() => {
    const unsub = listenPlaces(setPlaces);
    return () => unsub();
  }, []);

- Create a place (from form data):
  import { createPlace } from "src/services/places";
  await createPlace({ title, description, category, riskLevel, access, lat, lng, addedBy: uid, isPublic: true });

Where to look for behavioral changes
- Map behavior and markers: `src/components/MapView.tsx` — update here when changing map appearance, marker layers, or UI overlay positions.
- Auth flow: `src/lib/firebase.ts` and `src/components/AuthBar.tsx` — sign-in is Google pop-up, components use `watchAuth` for reactive state.
- Data transformations: `src/services/places.ts` — this file normalizes Firestore documents into the local `Place` type. If you change Firestore field names, update this file first.

Notes and gotchas
- Firestore timestamps may be returned as objects; `listenPlaces` currently uses `toMillis()` when present. Keep that conversion when editing.
- The `createPlace` function generates the document `id` client-side using `uuid()` and uses `serverTimestamp()` for `createdAt`. Tests or batch imports should respect that shape.

## Testing

The repository includes multiple testing layers:

**Unit Tests:**
- Run with: `npm run test:unit`
- Located in: `tests/unit/`
- Example: `tests/unit/reloadGuard.test.ts` tests app reload logic

**Logic Tests (Vitest):**
- Run with: `npm run test:logic`
- Uses Vitest for component and utility testing
- Configuration: `vitest.config.ts`

**End-to-End Tests (Playwright):**
- Run with: `npm run test:e2e` or `npx playwright test`
- Located in: `tests/playwright/`
- Key tests:
  - `app-load.spec.ts` — app initialization and basic functionality
  - `map-smoke.spec.ts` — map rendering and interactions
  - `pro-page.spec.ts` — Pro subscription features
- **Important:** E2E tests require build artifacts. Always run:
  ```bash
  VITE_ENABLE_E2E_HOOKS=1 npm run build
  npm run preview
  npm run test:e2e
  ```
- QA hooks are enabled via `VITE_ENABLE_E2E_HOOKS=1` environment variable
- Playwright retries once on failure and uploads artifacts on CI

**Firestore Rules Tests:**
- Located in: `tests/firestore/`
- Test security rules using `@firebase/rules-unit-testing`
- Example: `tests/firestore/stories.rules.test.ts`

**Testing Guidelines:**
- Write tests for new features that change business logic
- E2E tests should exercise real user workflows
- Always run tests before committing significant changes
- Use `npm run lint` to catch style issues before testing
- If a test fails unrelated to your changes, note it but focus on your work

## Code Style and Standards

**TypeScript:**
- Strict mode is enabled (`tsconfig.app.json`)
- Avoid `any` types when possible (though linter allows them)
- Use explicit return types for exported functions
- Unused variables should be prefixed with `_` (e.g., `_unusedParam`)

**React:**
- Use functional components with hooks (no class components)
- Follow React 19 patterns (concurrent features supported)
- Keep components small and focused (under 300 lines)
- Use proper hook dependencies (`react-hooks/exhaustive-deps` is a warning)
- Components should be self-contained when possible

**Imports:**
- Use absolute imports from `src/` (configured in tsconfig)
- Import order: React, third-party, local components, utilities, types
- Group related imports together

**Linting:**
- Run `npm run lint` to check code style
- ESLint config: `eslint.config.js`
- Key rules:
  - TypeScript recommended rules
  - React hooks rules (latest)
  - React refresh patterns for Vite HMR
  - JSX accessibility (jsx-a11y) warnings
- All accessibility issues are warnings, not errors
- Fix linting issues before committing when practical

**Formatting:**
- Keep lines under 120 characters when practical
- Use 2-space indentation (standard for JS/TS)
- Add trailing commas in multi-line objects/arrays
- Use template literals for string concatenation

## Project Structure

```
urbexqueensmap/
├── .github/
│   ├── copilot-instructions.md   # This file
│   ├── workflows/                # GitHub Actions CI/CD
│   └── dependabot.yml            # Dependency updates
├── functions/                    # Firebase Cloud Functions
├── public/                       # Static assets
├── scripts/                      # Utility scripts (admin, backfill)
├── shared/                       # Shared code between client/functions
├── src/
│   ├── components/               # React components
│   │   ├── MapView.tsx          # Main map component
│   │   ├── MapBase.tsx          # Debug map component
│   │   ├── AddPlaceForm.tsx     # Place creation modal
│   │   └── AuthBar.tsx          # Authentication UI
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom React hooks
│   ├── lib/
│   │   ├── firebase.ts          # Firebase initialization
│   │   └── stripeClient.ts      # Stripe client setup
│   ├── pages/                    # Page-level components
│   ├── services/
│   │   └── places.ts            # Firestore places API
│   ├── styles/                   # CSS modules and global styles
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # App entry point
│   └── bootstrap.tsx             # Initialization logic
├── tests/
│   ├── firestore/                # Firestore rules tests
│   ├── playwright/               # E2E tests
│   └── unit/                     # Unit tests
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Firestore composite indexes
├── storage.rules                 # Firebase Storage rules
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite bundler config
├── vitest.config.ts              # Vitest test config
└── playwright.config.ts          # Playwright E2E config
```

## Security Best Practices

**Authentication:**
- Never bypass authentication checks
- Always verify `request.auth.uid` in Firestore rules
- Use `watchAuth()` for client-side auth state management
- Google Sign-In is the only supported auth method

**Environment Variables:**
- All client-side env vars must be prefixed with `VITE_`
- Never hardcode API keys or secrets
- Use `.env` for local development (not committed)
- Production secrets are managed via GitHub Secrets
- Required variables:
  - `VITE_MAPBOX_TOKEN` (public token starting with `pk.`)
  - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_STRIPE_PUBLIC_KEY` (starts with `pk_`)

**Firestore Security:**
- Security rules are in `firestore.rules`
- Test rules changes with `tests/firestore/` tests
- Admin operations require hardcoded admin UID check
- Pro features check `users/{uid}.isPro` field
- Never expose sensitive user data to unauthorized users

**Content Security Policy (CSP):**
- CSP is configured via inline script in `index.html`
- Set `VITE_ENFORCE_CSP=1` to enable enforcement mode (default: report-only)
- CSP violations are reported to Cloud Function endpoint
- Be cautious with `unsafe-eval` and `unsafe-inline`

**Dependencies:**
- Review dependency updates from Dependabot
- Run security audits: `npm audit`
- Update vulnerable dependencies promptly
- Test after updating major versions

## Contribution Guidelines

**Before Starting Work:**
1. Pull latest changes: `git pull origin main`
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env` and configure if needed

**During Development:**
1. Run dev server: `npm run dev`
2. Make small, focused commits
3. Write descriptive commit messages
4. Run linter: `npm run lint`
5. Run relevant tests (unit, logic, or E2E)
6. Test in browser manually for UI changes

**Before Committing:**
1. Ensure code builds: `npm run build`
2. Run linter and fix issues: `npm run lint`
3. Run tests that cover your changes
4. Review your changes: `git diff`
5. Test the build: `npm run preview`

**Pull Request Guidelines:**
1. Create PR with clear title and description
2. Reference related issues (e.g., "Fixes #123")
3. Ensure CI passes (build, lint, tests)
4. Request review from maintainers
5. Address review feedback promptly
6. Squash commits if requested

**Branching Strategy:**
- `main` — production-ready code
- `feature/*` — new features
- `fix/*` — bug fixes
- `docs/*` — documentation updates
- `refactor/*` — code refactoring

## Known Issues and Technical Debt

**Current Limitations:**
- Admin system uses hardcoded UID (needs database-driven admin management)
- CSP is in report-only mode (needs validation before enforcement)
- Some accessibility warnings remain (jsx-a11y rules are warnings)
- Firestore offline persistence can cause stale data issues
- Map clustering performance degrades with >1000 markers

**Future Improvements:**
- Implement proper admin role management in Firestore
- Add more comprehensive E2E test coverage
- Optimize map rendering for large datasets
- Add search and filtering for places
- Implement real-time notifications
- Add internationalization (i18n) for multi-language support
- Migrate to more granular CSP without unsafe-inline/eval

**Performance Considerations:**
- Use React.memo() for expensive components
- Implement virtual scrolling for large lists (react-window is available)
- Optimize Firestore queries with indexes
- Use map clustering to reduce marker count
- Lazy load images and components when possible

## Useful Commands

```bash
# Development
npm run dev                      # Start dev server with HMR
npm run build                    # Production build
npm run preview                  # Preview production build locally
npm run lint                     # Run ESLint

# Testing
npm run test:unit                # Run unit tests
npm run test:logic               # Run Vitest tests
npm run test:e2e                 # Run Playwright E2E tests
npx playwright test --ui         # Playwright UI mode
npx playwright test --debug      # Debug Playwright tests

# Firebase
npm run firebase:emulate         # Run Firebase emulators
npm run deploy:hosting           # Deploy to Firebase Hosting

# Admin Scripts
npm run set-admin                # Set user as admin
npm run backfill-users           # Backfill user search fields
npm run backfill-place-geohash   # Add geohash to places
```

## Troubleshooting

**Build Fails:**
- Check all required env variables are set
- Run `npm install` to ensure dependencies are current
- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check TypeScript errors: `npx tsc --noEmit`

**Tests Fail:**
- Ensure you have the latest code: `git pull`
- Rebuild: `npm run build`
- For E2E tests, ensure `VITE_ENABLE_E2E_HOOKS=1` is set
- Check if ports are available (4173 for preview, etc.)
- Review test logs and traces in `test-results/`

**Map Not Rendering:**
- Verify `VITE_MAPBOX_TOKEN` is set and valid
- Check browser console for errors
- Ensure Mapbox CSS is imported in `main.tsx`
- Check CSP isn't blocking Mapbox resources

**Firebase Connection Issues:**
- Verify all Firebase env variables are correct
- Check Firebase project settings
- Review Firestore rules for permission issues
- Check browser console for Firebase errors

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vite.dev/guide/)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Playwright Testing](https://playwright.dev/)

## Questions or Issues?

If something looks missing or you need clarification on any section, ask for guidance. This is a living document that should evolve with the project.
