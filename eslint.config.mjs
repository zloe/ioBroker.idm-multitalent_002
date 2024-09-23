export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    env: {
      es2021: true,
      node: true,
      mocha: true
    },
    plugins: [],
    rules: {
      indent: ['error', 4, { SwitchCase: 1 }],
      'no-console': 'off',
      'no-var': 'error',
      'no-trailing-spaces': 'error',
      'prefer-const': 'error',
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ['error', 'always']
    }
  }
];
