/**
 * Seed Data Generator — gera massa de dados completa para ambiente dev.
 *
 * Fluxo:
 *   1. Auth + verificação de conectividade
 *   2. 7 entrevistas via UI Playwright (mensagens + upload de documento)
 *   3. 6 estimativas (API + injeção DB) com status variados
 *   4. 5 projetos (API + injeção DB) com milestones/tasks
 *   5. Verificação no admin (screenshots)
 *
 * Execução:
 *   cd tests/e2e && pnpm seed
 *   # ou da raiz:
 *   pnpm seed:e2e
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

import {
  BASE_URL,
  TEST_EMAIL,
  TEST_PASSWORD,
  FIXTURES_DIR,
  createSession,
  sleep,
} from './seed-config.js';

import { INTERVIEW_SCENARIOS } from './data/interview-scenarios.js';
import {
  ESTIMATE_RESULT_TELEMEDICINA,
  ESTIMATE_RESULT_MARKETPLACE,
  AGENT_STEPS_COMPLETE,
  AGENT_STEPS_RUNNING,
  AGENT_STEPS_FAILED,
} from './data/estimate-results.js';
import { PROJECT_DEFINITIONS } from './data/project-definitions.js';

import { createInterview, runInterviewFlow, getInterviewMaturity } from './helpers/interview-helper.js';
import {
  triggerEstimate,
  injectEstimateResult,
  getEstimateByInterview,
  createEstimateDirect,
} from './helpers/estimate-helper.js';
import { seedProject } from './helpers/project-helper.js';
import { getUserIdByEmail, closePool } from './helpers/db-seeder.js';

// IDs coletados durante a execução
const state = {
  sessionCookie: '',
  userId: '',
  interviewIds: [] as string[],   // [0..6] = 7 entrevistas
  estimateIds: [] as string[],    // [0..5] = 6 estimativas
  projectIds: [] as string[],     // [0..4] = 5 projetos
};

// ─── SETUP ─────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SEED DATA GENERATOR — oute.me dev');
  console.log('═══════════════════════════════════════════════════════\n');

  // Autentica uma única vez
  console.log('[setup] Autenticando...');
  state.sessionCookie = await createSession(TEST_EMAIL, TEST_PASSWORD);
  console.log('[setup] Sessão criada com sucesso');

  // Garante que o diretório de screenshots existe
  const screenshotsDir = path.join(import.meta.dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
});

test.afterAll(async () => {
  await closePool();
  console.log('\n[teardown] Pool DB fechado');
  printSummary();
});

// ─── FASE 1: ENTREVISTAS ────────────────────────────────────────────────────

test('1.1 — Criar 7 entrevistas com mensagens e uploads', async ({ page, context }) => {
  // Injeta sessão no browser context
  await context.clearCookies();
  await context.addCookies([{
    name: '__session',
    value: state.sessionCookie,
    url: BASE_URL,
    httpOnly: true,
    secure: BASE_URL.startsWith('https'),
    sameSite: 'Lax',
  }]);

  for (let i = 0; i < INTERVIEW_SCENARIOS.length; i++) {
    const scenario = INTERVIEW_SCENARIOS[i];
    console.log(`\n[entrevista ${i + 1}/7] ${scenario.title}`);

    // Cria a entrevista via API
    const interviewId = await createInterview(state.sessionCookie, scenario.title);
    state.interviewIds.push(interviewId);
    console.log(`  ID: ${interviewId}`);

    // Executa o fluxo completo via UI (mensagens + upload)
    await runInterviewFlow(page, interviewId, scenario, state.sessionCookie);

    // Verifica maturity final
    const maturity = await getInterviewMaturity(state.sessionCookie, interviewId);
    console.log(`  Maturity obtida: ${maturity.toFixed(3)} (esperada: ~${scenario.expectedMaturity})`);

    // Pausa entre entrevistas
    if (i < INTERVIEW_SCENARIOS.length - 1) {
      await sleep(1500);
    }
  }

  expect(state.interviewIds).toHaveLength(7);
  console.log(`\n[entrevistas] ✓ ${state.interviewIds.length} entrevistas criadas`);
});

// ─── FASE 2: ESTIMATIVAS ─────────────────────────────────────────────────────

test('2.1 — Criar estimativas e injetar status/results via DB', async () => {
  // Precisa dos interview IDs da fase anterior
  expect(state.interviewIds.length).toBeGreaterThanOrEqual(7);

  // Obtém o userId para criação direta no banco
  state.userId = await getUserIdByEmail(TEST_EMAIL);

  // Estimate #1: pending_approval (entrevista #3 — Telemedicina)
  console.log('\n[estimate 1/6] pending_approval — Telemedicina');
  const e1Id = await createEstimateDirect(state.userId, state.interviewIds[2]);
  await injectEstimateResult(e1Id, 'pending_approval', ESTIMATE_RESULT_TELEMEDICINA, AGENT_STEPS_COMPLETE);
  state.estimateIds.push(e1Id);

  // Estimate #2: pending (entrevista #4 — Marketplace B2B)
  console.log('[estimate 2/6] pending — Marketplace B2B');
  const e2Id = await createEstimateDirect(state.userId, state.interviewIds[3]);
  // Status pending = sem result, sem steps preenchidos (estado inicial)
  state.estimateIds.push(e2Id);

  // Estimate #3: running (entrevista #5 — Gestão Escolar)
  console.log('[estimate 3/6] running — Gestão Escolar');
  const e3Id = await createEstimateDirect(state.userId, state.interviewIds[4]);
  await injectEstimateResult(e3Id, 'running', null, AGENT_STEPS_RUNNING);
  state.estimateIds.push(e3Id);

  // Estimate #4: done (entrevista #6 — E-commerce Moda)
  console.log('[estimate 4/6] done — E-commerce Moda');
  const e4Id = await createEstimateDirect(state.userId, state.interviewIds[5]);
  await injectEstimateResult(e4Id, 'done', ESTIMATE_RESULT_MARKETPLACE, AGENT_STEPS_COMPLETE);
  state.estimateIds.push(e4Id);

  // Estimate #5: failed (entrevista #7 — Gestão de Frotas)
  console.log('[estimate 5/6] failed — Gestão de Frotas');
  const e5Id = await createEstimateDirect(state.userId, state.interviewIds[6]);
  await injectEstimateResult(
    e5Id,
    'failed',
    null,
    AGENT_STEPS_FAILED,
    'LLM returned invalid JSON after 3 retries: unexpected token at position 847. Agent: reviewer',
  );
  state.estimateIds.push(e5Id);

  // Estimate #6: approved (também da entrevista #6 — E-commerce Moda, estimate adicional)
  console.log('[estimate 6/6] approved — E-commerce Moda (aprovado)');
  const e6Id = await createEstimateDirect(state.userId, state.interviewIds[5]);
  await injectEstimateResult(e6Id, 'approved', ESTIMATE_RESULT_MARKETPLACE, AGENT_STEPS_COMPLETE);
  state.estimateIds.push(e6Id);

  expect(state.estimateIds).toHaveLength(6);
  console.log(`\n[estimativas] ✓ ${state.estimateIds.length} estimativas criadas`);
});

// ─── FASE 3: PROJETOS ─────────────────────────────────────────────────────────

test('3.1 — Criar 5 projetos com milestones e tasks', async () => {
  expect(state.estimateIds.length).toBeGreaterThanOrEqual(6);

  // Projeto #1 — recém-criado (estimate #1 pending_approval da Telemedicina)
  console.log('\n[projeto 1/5] Telemedicina MVP');
  const p1Id = await seedProject(state.sessionCookie, state.estimateIds[0], PROJECT_DEFINITIONS[0]);
  state.projectIds.push(p1Id);

  // Projeto #2 — em andamento (estimate #6 approved do E-commerce, reusando como base)
  console.log('[projeto 2/5] ERP Industrial MVP');
  const p2Id = await seedProject(state.sessionCookie, state.estimateIds[5], PROJECT_DEFINITIONS[1]);
  state.projectIds.push(p2Id);

  // Projeto #3 — quase pronto (estimate #4 done)
  console.log('[projeto 3/5] E-commerce de Moda MVP');
  const p3Id = await seedProject(state.sessionCookie, state.estimateIds[3], PROJECT_DEFINITIONS[2]);
  state.projectIds.push(p3Id);

  // Projeto #4 — finalizado (cria novo estimate approved para ter projeto completo)
  console.log('[projeto 4/5] Gestão de Frotas Fase 1');
  const extraEstimateId = await createEstimateDirect(state.userId, state.interviewIds[6]);
  await injectEstimateResult(extraEstimateId, 'approved', ESTIMATE_RESULT_MARKETPLACE, AGENT_STEPS_COMPLETE);
  const p4Id = await seedProject(state.sessionCookie, extraEstimateId, PROJECT_DEFINITIONS[3]);
  state.projectIds.push(p4Id);

  // Projeto #5 — grande, 4 milestones (estimate #6 approved)
  console.log('[projeto 5/5] SaaS Gestão Escolar');
  const extraEstimateId2 = await createEstimateDirect(state.userId, state.interviewIds[4]);
  await injectEstimateResult(extraEstimateId2, 'approved', ESTIMATE_RESULT_TELEMEDICINA, AGENT_STEPS_COMPLETE);
  const p5Id = await seedProject(state.sessionCookie, extraEstimateId2, PROJECT_DEFINITIONS[4]);
  state.projectIds.push(p5Id);

  expect(state.projectIds).toHaveLength(5);
  console.log(`\n[projetos] ✓ ${state.projectIds.length} projetos criados`);
});

// ─── FASE 4: VERIFICAÇÃO NO ADMIN ─────────────────────────────────────────────

test('4.1 — Verificar admin/cockpit (entrevistas)', async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{
    name: '__session',
    value: state.sessionCookie,
    url: BASE_URL,
    httpOnly: true,
    secure: BASE_URL.startsWith('https'),
    sameSite: 'Lax',
  }]);

  await page.goto('/admin/cockpit', { waitUntil: 'networkidle', timeout: 30_000 });

  // Verifica que a página carregou
  const title = await page.title();
  console.log(`\n[verify] /admin/cockpit — title: "${title}"`);

  // Screenshot
  await page.screenshot({
    path: path.join(FIXTURES_DIR, '../screenshots/admin-cockpit.png'),
    fullPage: true,
  });

  // Verificação básica: deve existir conteúdo na página
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(100);
  console.log('[verify] /admin/cockpit ✓');
});

test('4.2 — Verificar admin/pipeline (estimativas)', async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{
    name: '__session',
    value: state.sessionCookie,
    url: BASE_URL,
    httpOnly: true,
    secure: BASE_URL.startsWith('https'),
    sameSite: 'Lax',
  }]);

  await page.goto('/admin/pipeline', { waitUntil: 'networkidle', timeout: 30_000 });

  const title = await page.title();
  console.log(`\n[verify] /admin/pipeline — title: "${title}"`);

  await page.screenshot({
    path: path.join(FIXTURES_DIR, '../screenshots/admin-pipeline.png'),
    fullPage: true,
  });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(100);
  console.log('[verify] /admin/pipeline ✓');
});

test('4.3 — Verificar admin/dashboard (métricas)', async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([{
    name: '__session',
    value: state.sessionCookie,
    url: BASE_URL,
    httpOnly: true,
    secure: BASE_URL.startsWith('https'),
    sameSite: 'Lax',
  }]);

  await page.goto('/admin/dashboard', { waitUntil: 'networkidle', timeout: 30_000 });

  const title = await page.title();
  console.log(`\n[verify] /admin/dashboard — title: "${title}"`);

  await page.screenshot({
    path: path.join(FIXTURES_DIR, '../screenshots/admin-dashboard.png'),
    fullPage: true,
  });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(100);
  console.log('[verify] /admin/dashboard ✓');
});

// ─── RESUMO ───────────────────────────────────────────────────────────────────

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SEED CONCLUÍDO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Entrevistas criadas : ${state.interviewIds.length}`);
  console.log(`  Estimativas criadas : ${state.estimateIds.length}`);
  console.log(`  Projetos criados    : ${state.projectIds.length}`);
  console.log('\n  IDs das Entrevistas:');
  INTERVIEW_SCENARIOS.forEach((s, i) => {
    console.log(`    [${i + 1}] ${state.interviewIds[i] ?? 'N/A'} — ${s.title}`);
  });
  console.log('\n  IDs das Estimativas:');
  const estimateLabels = [
    'pending_approval (Telemedicina)',
    'pending       (Marketplace)',
    'running       (Gestão Escolar)',
    'done          (E-commerce)',
    'failed        (Frotas)',
    'approved      (E-commerce 2)',
  ];
  state.estimateIds.forEach((id, i) => {
    console.log(`    [${i + 1}] ${id} — ${estimateLabels[i] ?? ''}`);
  });
  console.log('\n  IDs dos Projetos:');
  PROJECT_DEFINITIONS.slice(0, 5).forEach((p, i) => {
    console.log(`    [${i + 1}] ${state.projectIds[i] ?? 'N/A'} — ${p.name}`);
  });
  console.log('\n  Screenshots em: tests/e2e/seed/screenshots/');
  console.log('═══════════════════════════════════════════════════════\n');
}
