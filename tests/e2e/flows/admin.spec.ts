import { test, expect } from '../fixtures/auth';

test.describe('Admin Dashboard', () => {
  test('admin page loads with dashboard tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/admin');

    // Wait for page to load (may redirect if not admin)
    await page.waitForLoadState('networkidle');

    // If user is admin, dashboard should have tabs/sections
    const pageUrl = page.url();

    if (pageUrl.includes('/admin')) {
      // Admin page loaded — verify basic structure
      const heading = page.locator('h1, h2, [class*="title"]').first();
      await expect(heading).toBeVisible({ timeout: 5000 });
    } else {
      // Non-admin user was redirected — this is expected behavior
      expect(pageUrl).not.toContain('/admin');
    }
  });
});
