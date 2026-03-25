import path from 'path';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
export const FIREBASE_API_KEY = process.env.E2E_FIREBASE_API_KEY ?? '';
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@oute.pro';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';
export const DATABASE_URL = process.env.DATABASE_URL ?? '';

export const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

export const FIXTURE_FILES = {
  pdf: path.join(FIXTURES_DIR, 'sample-requirements.pdf'),
  docx: path.join(FIXTURES_DIR, 'sample-architecture.docx'),
  xlsx: path.join(FIXTURES_DIR, 'sample-budget.xlsx'),
  csv: path.join(FIXTURES_DIR, 'sample-timeline.csv'),
  pptx: path.join(FIXTURES_DIR, 'sample-presentation.pptx'),
} as const;

export const SEED_PREFIX = '[SEED]';

/** Aguarda N ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Obtém Firebase idToken via REST */
export async function getFirebaseIdToken(email: string, password: string): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Firebase auth falhou (${resp.status}): ${body}`);
  }
  const json = (await resp.json()) as { idToken: string };
  return json.idToken;
}

/** Cria sessão server-side e retorna o valor do cookie __session */
export async function createSession(email: string, password: string): Promise<string> {
  const idToken = await getFirebaseIdToken(email, password);
  const resp = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Criação de sessão falhou (${resp.status}): ${body}`);
  }
  const setCookie = resp.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/__session=([^;]+)/);
  if (!match) throw new Error('Cookie __session não encontrado na resposta');
  return match[1];
}
