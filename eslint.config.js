import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // Base config for all files
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // Remove console statements (except error/warn in critical files)
      'no-console': 'error',
      
      // Ban any type usage
      '@typescript-eslint/no-explicit-any': 'error',
      
      // Ban ts-ignore and ts-nocheck
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-expect-error': 'allow-with-description'
      }],
      
      // No debugger statements
      'no-debugger': 'error',
      
      // Unused variables
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      
      // Some rules to skip for now
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  
  // Allow console in test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  
  // Allow console.error and console.warn in critical files
  {
    files: ['server/audit/**', 'server/middleware/**', 'server/rbac/**'],
    rules: {
      'no-console': ['error', { allow: ['error', 'warn'] }]
    }
  },
  
  // Ignore certain directories
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.cache/**',
      '*.config.js',
      '*.config.ts',
      'scripts/**'
    ]
  }
];