/**
 * CSS lint rules. Component styles (*.module.css) must take every visual value from
 * design tokens (see docs/design-tokens.md); tokens.css and base.css define those tokens.
 *
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: [
    'dist/**',
    'coverage/**',
    'node_modules/**',
    // Token and base definitions are the one place raw values belong
    'src/styles/tokens.css',
    'src/styles/base.css',
  ],
  rules: {
    // Vite resolves plain string imports; url() adds nothing
    'import-notation': 'string',
    // docs/design-tokens.md §6 writes breakpoints as (min-width: …)
    'media-feature-range-notation': 'prefix',
    // CSS Modules: class names are camelCase so they read as styles.fooBar in TSX
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: 'Use camelCase class names (e.g. .primaryButton)' },
    ],
  },
  overrides: [
    {
      files: ['**/*.module.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': [
          [
            'color',
            'background-color',
            'border-color',
            'outline-color',
            'fill',
            'stroke',
            'font-size',
            'font-weight',
            'line-height',
            'border-radius',
            'box-shadow',
            'z-index',
            '/^(row-|column-)?gap$/',
            '/^margin/',
            '/^padding/',
          ],
          {
            ignoreVariables: true,
            // rgb(), calc(12px) … would bypass the tokens; only var(--…) is allowed
            ignoreFunctions: false,
            ignoreValues: [
              '0',
              'auto',
              'inherit',
              'currentColor',
              'currentcolor',
              'transparent',
              '100%',
            ],
            expandShorthand: true,
            message: 'Use a design token var(--…) for "${property}" (docs/design-tokens.md)',
          },
        ],
      },
    },
  ],
};
