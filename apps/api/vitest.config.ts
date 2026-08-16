import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 62,
        branches: 45,
        functions: 58,
        lines: 62,
      },
    },
  },
});
