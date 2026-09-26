import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.tsx'],
    ...reactRefresh.configs.vite,
  },
  {
    // UI text must go through t(); tests may assert on literal strings
    files: ['src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
  {
    files: ['*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Must stay last: turns off rules that conflict with Prettier formatting
  eslintConfigPrettier
);
