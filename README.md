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
