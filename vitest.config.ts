import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    alias: {
      react: resolve('node_modules/react'),
      'react-dom': resolve('node_modules/react-dom'),
      'react-router-dom': resolve('node_modules/react-router-dom'),
    },
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      '.codex/**',
      'docs/plans/**',
      '.worktrees/**',
      '.claude/worktrees/**',
      'release/**',
    ],
    // Many of our web tests rely on React's test utilities (act, etc.).
    // If NODE_ENV is accidentally set to "production" in the environment,
    // React switches to the production build where act() is not supported.
    // Force a safe default so local/CI runs are stable.
    env: {
      NODE_ENV: process.env.NODE_ENV && process.env.NODE_ENV !== 'production' ? process.env.NODE_ENV : 'test',
    },
  },
});
