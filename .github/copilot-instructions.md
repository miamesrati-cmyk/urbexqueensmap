## Quick orientation for AI coding agents

This is a small React + TypeScript + Vite single-page app that visualizes and manages "urbex" spots on a Mapbox map and stores data in Firebase Firestore. The guidance below points to the concrete files and patterns an agent should use when modifying or extending the project.

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
- No tests are present in the repo currently — run builds and manual dev checks after changes.

If something looks missing or you want me to expand a section (e.g., add example tests or a small code-mod), tell me which area to focus on and I'll iterate.
