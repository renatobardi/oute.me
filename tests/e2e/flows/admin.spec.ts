import { test, expect } from '../fixtures/auth';

test.describe('Admin Access Control', () => {
  test('usuário não-admin é redirecionado para /interviews ao acessar /admin', async ({
    nonAdminPage: page,
  }) => {
    await page.goto('/admin');

    await page.waitForURL(/\/interviews/, { timeout: 10000 });
    expect(page.url()).not.toContain('/admin');
  });

  test('admin acessa /admin normalmente', async ({ authenticatedPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    const heading = page.locator('h1, h2, [class*="title"]').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});
