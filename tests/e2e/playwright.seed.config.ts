import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './seed',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'seed', use: { ...devices['Desktop Chrome'] } },
  ],
});
