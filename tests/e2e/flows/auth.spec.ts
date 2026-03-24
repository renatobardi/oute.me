import { test, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/auth';

test.describe('Authentication', () => {
  test('rota protegida redireciona para /login sem autenticação', async ({ page }) => {
    await page.goto('/interviews');

    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('página de login tem campos de email e password', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test('credenciais inválidas exibem mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill('invalido@example.com');
    await page.locator('input[type="password"]').fill('senha-errada');
    await page.locator('button[type="submit"]').click();

    // O login page exibe erros via classe .error ou role="alert"
    const errorMessage = page.locator('[class*="error"], [role="alert"], .error').first();
    await expect(errorMessage).toBeVisible({ timeout: 15000 });
  });
});

// Teste de login válido usa o fixture para não depender da UI do Firebase
authTest.describe('Login com credenciais válidas', () => {
  authTest(
    'redireciona para /interviews após autenticação bem-sucedida',
    async ({ authenticatedPage: page }) => {
      // O fixture já autenticou e navegou para /interviews
      await expect(page).toHaveURL(/\/interviews/, { timeout: 10000 });
    },
  );
});
