module.exports = {
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['**/dist/*.js', '**/dist/*.d.ts'],
  rules: {
    'no-empty': 'off',
    'no-console': 'off',
    'no-useless-escape': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    'import/first': 2,
  },
};
