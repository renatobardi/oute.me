/**
 * Deleta todos os usuários do Firebase Authentication.
 * Uso: node scripts/clear-firebase-users.mjs
 *
 * Requer variáveis de ambiente:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * Ou Application Default Credentials via: gcloud auth application-default login
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId) {
  console.error('❌ FIREBASE_PROJECT_ID não definido');
  process.exit(1);
}

const app = initializeApp({
  credential: (clientEmail && privateKey)
    ? cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') })
    : applicationDefault(),
  projectId,
});

const auth = getAuth(app);

async function deleteAllUsers() {
  let total = 0;
  let pageToken;

  console.log('🔍 Listando usuários...');

  do {
    const result = await auth.listUsers(1000, pageToken);
    const uids = result.users.map(u => u.uid);

    if (uids.length === 0) break;

    await auth.deleteUsers(uids);
    total += uids.length;
    console.log(`🗑️  Deletados ${total} usuários até agora...`);

    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`✅ Total deletado: ${total} usuários`);
}

deleteAllUsers().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
