import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import type { Linter } from 'eslint';

const config: Linter.Config[] = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin as unknown as Record<string, unknown>,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      'no-console': 'error',
    },
  },
  {
    // CLI code may use console for user-facing output
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default config;
