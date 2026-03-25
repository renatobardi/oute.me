#!/usr/bin/env tsx
/**
 * Remove APENAS dados criados pelo seed (identificados pelo prefixo "[SEED]").
 *
 * Uso:
 *   pnpm seed:clean
 *
 * Variável de ambiente requerida:
 *   DATABASE_URL=postgresql://user:pass@host:5432/dbname
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Erro: DATABASE_URL não definida');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function cleanSeedData() {
  console.log('Limpando dados de seed (prefixo "[SEED]")...\n');

  // Tasks dos projetos seed
  const deletedTasks = await sql`
    DELETE FROM public.tasks
    WHERE project_id IN (
      SELECT id FROM public.projects WHERE name LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Tasks deletadas: ${deletedTasks.length}`);

  // Milestones dos projetos seed
  const deletedMilestones = await sql`
    DELETE FROM public.milestones
    WHERE project_id IN (
      SELECT id FROM public.projects WHERE name LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Milestones deletados: ${deletedMilestones.length}`);

  // Projetos seed
  const deletedProjects = await sql`
    DELETE FROM public.projects
    WHERE name LIKE '[SEED]%'
    RETURNING id
  `;
  console.log(`  Projetos deletados: ${deletedProjects.length}`);

  // Estimate runs dos estimates vinculados às entrevistas seed
  const deletedRuns = await sql`
    DELETE FROM public.estimate_runs
    WHERE estimate_id IN (
      SELECT e.id
      FROM public.estimates e
      JOIN public.interviews i ON e.interview_id = i.id
      WHERE i.title LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Estimate runs deletados: ${deletedRuns.length}`);

  // Estimates vinculados às entrevistas seed
  const deletedEstimates = await sql`
    DELETE FROM public.estimates
    WHERE interview_id IN (
      SELECT id FROM public.interviews WHERE title LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Estimates deletados: ${deletedEstimates.length}`);

  // Documentos das entrevistas seed
  const deletedDocs = await sql`
    DELETE FROM public.documents
    WHERE interview_id IN (
      SELECT id FROM public.interviews WHERE title LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Documentos deletados: ${deletedDocs.length}`);

  // Mensagens das entrevistas seed
  const deletedMsgs = await sql`
    DELETE FROM public.interview_messages
    WHERE interview_id IN (
      SELECT id FROM public.interviews WHERE title LIKE '[SEED]%'
    )
    RETURNING id
  `;
  console.log(`  Mensagens deletadas: ${deletedMsgs.length}`);

  // Entrevistas seed
  const deletedInterviews = await sql`
    DELETE FROM public.interviews
    WHERE title LIKE '[SEED]%'
    RETURNING id
  `;
  console.log(`  Entrevistas deletadas: ${deletedInterviews.length}`);

  console.log('\nLimpeza concluída.');
  await sql.end();
}

cleanSeedData().catch((err) => {
  console.error('Erro durante a limpeza:', err);
  process.exit(1);
});
