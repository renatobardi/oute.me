/**
 * Apaga todas as entrevistas, projetos e documentos GCS de um usuário.
 *
 * Uso — dev:
 *   DATABASE_URL=postgresql://postgres:password@localhost:5432/oute_develop \
 *   GCS_BUCKET=oute-dev-uploads \
 *   node scripts/clear-user-data.mjs renatobardicabral@gmail.com
 *
 * Uso — prd (via Cloud SQL Auth Proxy na porta 5432):
 *   DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/oute_production \
 *   GCS_BUCKET=oute-prod-uploads \
 *   node scripts/clear-user-data.mjs renatobardicabral@gmail.com
 *
 * Requer ADC ativo: gcloud auth application-default login
 */

import postgres from 'postgres';
import { Storage } from '@google-cloud/storage';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/clear-user-data.mjs <email>');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
const GCS_BUCKET = process.env.GCS_BUCKET;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}
if (!GCS_BUCKET) {
  console.error('GCS_BUCKET não definida');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET);

async function run() {
  // 1. Busca o usuário
  const [user] = await sql`SELECT id FROM public.users WHERE email = ${email}`;
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    await sql.end();
    process.exit(1);
  }
  console.log(`Usuário encontrado: ${user.id}`);

  // 2. Coleta os storage_paths dos documentos
  const docs = await sql`
    SELECT d.storage_path
    FROM public.documents d
    JOIN public.interviews i ON i.id = d.interview_id
    WHERE i.user_id = ${user.id}
  `;
  console.log(`Documentos no bucket a apagar: ${docs.length}`);

  // 3. Apaga arquivos do GCS
  let gcsDeleted = 0;
  let gcsFailed = 0;
  for (const doc of docs) {
    try {
      await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
      gcsDeleted++;
    } catch (err) {
      console.warn(`  Falha ao apagar GCS ${doc.storage_path}: ${err.message}`);
      gcsFailed++;
    }
  }
  console.log(`GCS: ${gcsDeleted} apagados, ${gcsFailed} falhas`);

  // 4. Apaga projetos (CASCADE: milestones, tasks)
  const { count: projectCount } = await sql`
    DELETE FROM public.projects WHERE user_id = ${user.id}
    RETURNING id
  `.then(rows => ({ count: rows.length }));
  console.log(`Projetos apagados: ${projectCount}`);

  // 5. Apaga entrevistas (CASCADE: interview_messages, documents, estimates, estimate_runs)
  const { count: interviewCount } = await sql`
    DELETE FROM public.interviews WHERE user_id = ${user.id}
    RETURNING id
  `.then(rows => ({ count: rows.length }));
  console.log(`Entrevistas apagadas: ${interviewCount}`);

  await sql.end();
  console.log('Concluído.');
}

run().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
