import { test, expect } from '../fixtures/auth';

test.describe('Interview Flow', () => {
  test('cria nova entrevista e envia mensagem', async ({ authenticatedPage: page }) => {
    // Fixture já navega para /interviews e verifica conteúdo

    // Clica em "Nova Entrevista"
    const newButton = page.getByRole('button', { name: /nova entrevista/i });
    await expect(newButton).toBeVisible({ timeout: 10000 });
    await newButton.click();

    // Aguarda navegação para a página de chat da entrevista
    await page.waitForURL(/\/interviews\/[^/]+$/, { timeout: 10000 });

    // Verifica que o input de chat está presente
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Envia uma mensagem
    await chatInput.fill('Quero estimar um sistema de gestão de projetos com React e Node.js');
    await chatInput.press('Enter');

    // Aguarda a resposta do assistente via SSE (até 30s)
    const assistantMessage = page
      .locator('[data-role="assistant"], .assistant-message, .chat-bubble-assistant')
      .first();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });

    // Verifica que houve conteúdo na resposta
    const messageText = await assistantMessage.textContent();
    expect(messageText).toBeTruthy();
    expect(messageText!.length).toBeGreaterThan(10);
  });

  test('exibe indicador de maturity na página de entrevista', async ({
    authenticatedPage: page,
  }) => {
    // Fixture já navega para /interviews e verifica conteúdo

    // Tenta acessar uma entrevista existente ou cria uma nova
    const interviewLink = page.locator('a[href*="/interviews/"]').first();
    const hasExisting = await interviewLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasExisting) {
      await interviewLink.click();
    } else {
      const newButton = page.getByRole('button', { name: /nova entrevista/i });
      await newButton.click();
      await page.waitForURL(/\/interviews\/[^/]+$/, { timeout: 10000 });
    }

    // O MaturityBar deve estar presente na página (mesmo com 0%)
    const maturityIndicator = page
      .locator('[class*="maturity"], [data-testid="maturity"]')
      .first();
    await expect(maturityIndicator).toBeVisible({ timeout: 10000 });
  });
});
