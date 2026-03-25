import type { Page } from '@playwright/test';
import { existsSync } from 'fs';
import { BASE_URL, FIXTURE_FILES, sleep } from '../seed-config.js';
import type { InterviewScenario } from '../data/interview-scenarios.js';

/**
 * Cria uma nova entrevista via API e retorna o interview_id.
 */
export async function createInterview(
  sessionCookie: string,
  title: string,
): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/interviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__session=${sessionCookie}`,
    },
    body: JSON.stringify({ title }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Falha ao criar entrevista (${resp.status}): ${body}`);
  }
  const json = (await resp.json()) as { id: string };
  return json.id;
}

/**
 * Envia uma mensagem no chat da entrevista e aguarda a resposta do assistente via SSE.
 * Usa a UI do Playwright para exercitar o fluxo real.
 */
export async function sendMessage(
  page: Page,
  message: string,
  timeoutMs = 60_000,
): Promise<void> {
  // Localiza o textarea do chat
  const textarea = page.locator('textarea[placeholder], textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill(message);
  await textarea.press('Enter');

  // Aguarda o assistente responder (indicador de loading desaparecer ou nova mensagem aparecer)
  // Tenta detectar spinner/loading, ou simplesmente aguarda nova mensagem
  try {
    await page.waitForSelector('[data-role="assistant"], [data-testid="assistant-message"]', {
      timeout: timeoutMs,
    });
  } catch {
    // Fallback: aguarda qualquer mudança no DOM por 5s
    await sleep(5000);
  }

  // Pequena pausa para o estado ser persistido
  await sleep(1000);
}

/**
 * Faz upload de um arquivo na interface da entrevista.
 */
export async function uploadDocument(
  page: Page,
  fixtureType: keyof typeof FIXTURE_FILES,
): Promise<void> {
  const filePath = FIXTURE_FILES[fixtureType];
  if (!existsSync(filePath)) {
    console.warn(`  [upload] Fixture não encontrada: ${filePath} — pulando upload`);
    return;
  }

  // Procura input de arquivo ou botão de upload
  const fileInput = page.locator('input[type="file"]').first();
  const isVisible = await fileInput.isVisible().catch(() => false);

  if (isVisible) {
    await fileInput.setInputFiles(filePath);
  } else {
    // Tenta encontrar botão de upload e clicar para expor o input
    const uploadBtn = page.locator(
      'button:has-text("Anexar"), button:has-text("Upload"), button:has-text("Arquivo"), [data-testid="upload"]'
    ).first();
    const btnVisible = await uploadBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await uploadBtn.click();
      await page.locator('input[type="file"]').first().setInputFiles(filePath);
    } else {
      console.warn('  [upload] Botão de upload não encontrado — pulando');
      return;
    }
  }

  // Aguarda confirmação de upload (toast, ícone de documento, ou pausa)
  await sleep(3000);
  console.log(`  [upload] Arquivo enviado: ${filePath}`);
}

/**
 * Executa o fluxo completo de uma entrevista via UI do Playwright:
 * navega para a entrevista, envia todas as mensagens, faz upload do documento.
 */
export async function runInterviewFlow(
  page: Page,
  interviewId: string,
  scenario: InterviewScenario,
  sessionCookie: string,
): Promise<void> {
  console.log(`  [interview] Iniciando: "${scenario.title}" (${scenario.messages.length} msgs)`);

  // Navega para a página da entrevista
  await page.goto(`/interviews/${interviewId}`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  // Enviar cada mensagem sequencialmente
  for (let i = 0; i < scenario.messages.length; i++) {
    const msg = scenario.messages[i];
    console.log(`    [msg ${i + 1}/${scenario.messages.length}] ${msg.slice(0, 60)}...`);
    await sendMessage(page, msg);
    // Pausa entre mensagens para evitar rate limiting
    if (i < scenario.messages.length - 1) {
      await sleep(2000);
    }
  }

  // Upload do arquivo de fixture
  await uploadDocument(page, scenario.fixtureFile);

  console.log(`  [interview] Concluída: "${scenario.title}"`);
}

/**
 * Verifica e retorna a maturity atual de uma entrevista via API.
 */
export async function getInterviewMaturity(
  sessionCookie: string,
  interviewId: string,
): Promise<number> {
  const resp = await fetch(`${BASE_URL}/api/interviews/${interviewId}`, {
    headers: { Cookie: `__session=${sessionCookie}` },
  });
  if (!resp.ok) return 0;
  const json = (await resp.json()) as { maturity?: number };
  return json.maturity ?? 0;
}
