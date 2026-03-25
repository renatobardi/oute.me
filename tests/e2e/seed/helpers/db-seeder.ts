import pg from 'pg';
import { DATABASE_URL } from '../seed-config.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    if (!DATABASE_URL) throw new Error('DATABASE_URL não definida');
    _pool = new Pool({ connectionString: DATABASE_URL });
  }
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Busca o user_id pelo email (usado para associar registros ao usuário de teste) */
export async function getUserIdByEmail(email: string): Promise<string> {
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM public.users WHERE email = $1',
    [email],
  );
  if (!row) throw new Error(`Usuário não encontrado no banco: ${email}`);
  return row.id;
}

/** Gera UUID v4 simples (Node 20+ tem crypto.randomUUID) */
export function uuid(): string {
  return crypto.randomUUID();
}

/** Gera um job_id estilo Cloud Tasks */
export function generateJobId(): string {
  return `seed-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
