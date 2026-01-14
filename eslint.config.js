import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

const downgradeSeverityToWarn = (configValue) => {
  if (typeof configValue === 'string') {
    if (configValue === 'off' || configValue === 'warn') {
      return configValue
    }
    return 'warn'
  }
  if (Array.isArray(configValue)) {
    const [severity, ...rest] = configValue
    if (severity === 'off' || severity === 'warn') {
      return configValue
    }
    return ['warn', ...rest]
  }
  return configValue
}

const downgradeRulesToWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([ruleName, configValue]) => [
      ruleName,
      downgradeSeverityToWarn(configValue),
    ])
  )

const jsxA11yRecommendedWarnRules = downgradeRulesToWarnings(
  jsxA11y.flatConfigs.recommended.rules
)

export default defineConfig([
  globalIgnores(['dist', 'archive']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...jsxA11yRecommendedWarnRules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
])
