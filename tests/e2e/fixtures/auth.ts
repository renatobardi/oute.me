import { test as base, type Page } from '@playwright/test';

/**
 * Firebase test user credentials.
 * Set via environment variables:
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 *
 * For CI, create a test user in Firebase with known credentials.
 */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@oute.pro',
  password: process.env.TEST_USER_PASSWORD || 'test-password-change-me',
};

/**
 * Extended test fixture with authenticated page.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *   test('my test', async ({ authenticatedPage }) => { ... });
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/login');

    // Wait for Firebase UI to load
    await page.waitForSelector('[data-testid="email-input"], input[type="email"]', {
      timeout: 10000,
    });

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard/projects
    await page.waitForURL(/\/(projects|$)/, { timeout: 15000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
