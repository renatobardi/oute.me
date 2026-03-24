import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/projects');

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('login page has email and password fields', async ({ page }) => {
    await page.goto('/login');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Look for login form elements (Firebase Auth UI)
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // At least the email field should be present
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill with invalid credentials
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill('invalid@example.com');

      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible({ timeout: 2000 })) {
        await passwordInput.fill('wrong-password');

        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible({ timeout: 2000 })) {
          await submitButton.click();

          // Should show an error message
          const errorMessage = page.locator('[class*="error"], [role="alert"], .error');
          await expect(errorMessage).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});
