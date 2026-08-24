import { defineConfig, devices } from '@playwright/test';

import { getEnv, resetEnv } from '@aptifum/config';

resetEnv();
const env = getEnv();

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: './e2e/storage-state.json',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec nest start',
      cwd: '../api',
      url: 'http://localhost:3000/docs',
      timeout: 120_000,
      env: { ...process.env, DB_NAME: env.DB_NAME_TEST, LOGIN_THROTTLE_LIMIT: '1000' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec vite --port 5173 --strictPort',
      cwd: '.',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
