import { test as base, type Page } from '@playwright/test';

/**
 * Credenciais via env vars:
 *
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD       — usuário admin (e2e-test@oute.pro)
 *   E2E_NONADMIN_EMAIL / E2E_NONADMIN_PASSWORD — usuário não-admin (e2e-nonadmin@oute.pro)
 *   E2E_FIREBASE_API_KEY                     — Web API key do projeto Firebase
 *   E2E_BASE_URL                             — URL base da aplicação
 */
const FIREBASE_API_KEY = process.env.E2E_FIREBASE_API_KEY ?? '';
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

// --- usuário admin ---
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@oute.pro';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

// --- usuário não-admin ---
const NONADMIN_EMAIL = process.env.E2E_NONADMIN_EMAIL ?? 'e2e-nonadmin@oute.pro';
const NONADMIN_PASSWORD = process.env.E2E_NONADMIN_PASSWORD ?? '';

/**
 * Obtém um Firebase idToken via REST API (sem UI, sem client SDK).
 */
async function getFirebaseIdToken(email: string, password: string): Promise<string> {
  const url =
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Firebase REST auth falhou (${resp.status}): ${body}`);
  }

  const json = (await resp.json()) as { idToken: string };
  return json.idToken;
}

/**
 * Cria uma sessão server-side e injeta o cookie __session no browser context.
 *
 * Usa Node fetch (não page.request) para evitar que o Playwright auto-armazene
 * o Set-Cookie com atributos implícitos que podem conflitar com a injeção manual.
 * Após obter o cookie, limpa qualquer cookie existente no context e injeta
 * um único cookie com atributos explícitos.
 */
async function injectSession(
  context: import('@playwright/test').BrowserContext,
  email: string,
  password: string,
): Promise<void> {
  const idToken = await getFirebaseIdToken(email, password);

  // Usa fetch nativo (não page.request) para não poluir o cookie jar do browser context
  const sessionResp = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!sessionResp.ok) {
    const body = await sessionResp.text();
    throw new Error(`Criação de sessão falhou (${sessionResp.status}): ${body}`);
  }

  const setCookieHeader = sessionResp.headers.get('set-cookie') ?? '';
  const sessionMatch = setCookieHeader.match(/__session=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Cookie __session não encontrado na resposta de /api/auth/session');
  }

  // Limpa cookies existentes e injeta um único cookie limpo
  await context.clearCookies();

  await context.addCookies([
    {
      name: '__session',
      value: sessionMatch[1],
      url: BASE_URL,
      httpOnly: true,
      secure: BASE_URL.startsWith('https'),
      sameSite: 'Lax',
    },
  ]);
}

type AuthFixtures = {
  /** Page autenticada como usuário admin (e2e-test@oute.pro). */
  authenticatedPage: Page;
  /** Page autenticada como usuário não-admin (e2e-nonadmin@oute.pro). */
  nonAdminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    await injectSession(context, TEST_EMAIL, TEST_PASSWORD);

    // Debug: verifica cookie antes do goto
    const cookiesBefore = await context.cookies();
    const sessionBefore = cookiesBefore.find((c) => c.name === '__session');
    console.log(`[auth-fixture] email=${TEST_EMAIL}`);
    console.log(`[auth-fixture] cookie: domain=${sessionBefore?.domain}, path=${sessionBefore?.path}, secure=${sessionBefore?.secure}, sameSite=${sessionBefore?.sameSite}`);

    // Captura response status
    const response = await page.goto('/interviews');
    console.log(`[auth-fixture] response status: ${response?.status()}`);
    console.log(`[auth-fixture] response url: ${response?.url()}`);

    await page.waitForURL(/\/interviews/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    console.log(`[auth-fixture] final URL: ${page.url()}`);
    console.log(`[auth-fixture] page title: ${await page.title()}`);

    await use(page);
  },

  nonAdminPage: async ({ page, context }, use) => {
    await injectSession(context, NONADMIN_EMAIL, NONADMIN_PASSWORD);
    await page.goto('/interviews');
    await page.waitForURL(/\/interviews/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
