#!/usr/bin/env tsx
/**
 * Runner de migrations PostgreSQL para oute.me
 *
 * Comandos:
 *   pnpm migrate status              – lista migrations e estado (applied/pending)
 *   pnpm migrate up                  – aplica todas as migrations pendentes
 *   pnpm migrate up --dry-run        – mostra o que seria aplicado sem executar
 *   pnpm migrate down <version>      – reverte uma migration (requer .down.sql)
 *   pnpm migrate down <version> --dry-run
 *   pnpm migrate baseline            – marca todas as migrations no disco como aplicadas
 *                                      sem executá-las (usar apenas na primeira config
 *                                      de um ambiente já populado)
 *   pnpm migrate baseline --dry-run
 *
 * Variável de ambiente requerida:
 *   DATABASE_URL=postgresql://user:pass@host:5432/dbname
 */

import { createHash } from 'crypto'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR)
  return files
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort()
    .map(f => f.replace('.sql', ''))
}

async function bootstrap(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version    TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum   TEXT        NOT NULL
    )
  `
}

async function getApplied(sql: postgres.Sql): Promise<Map<string, string>> {
  const rows = await sql<{ version: string; checksum: string }[]>`
    SELECT version, checksum FROM public.schema_migrations ORDER BY version
  `
  return new Map(rows.map(r => [r.version, r.checksum]))
}

function checksumOf(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function hr(): void {
  console.log('─'.repeat(60))
}

async function cmdStatus(sql: postgres.Sql): Promise<void> {
  const files = await getMigrationFiles()
  const applied = await getApplied(sql)

  console.log('\nMigration Status:')
  hr()
  for (const version of files) {
    const state = applied.has(version) ? '✓ applied ' : '○ pending '
    console.log(`  ${state}  ${version}`)
  }
  hr()
  const pendingCount = files.filter(f => !applied.has(f)).length
  console.log(`  ${files.length - pendingCount} applied, ${pendingCount} pending\n`)
}

async function cmdUp(sql: postgres.Sql, dryRun: boolean): Promise<void> {
  const files = await getMigrationFiles()
  const applied = await getApplied(sql)
  const pending = files.filter(f => !applied.has(f))

  if (pending.length === 0) {
    console.log('Nenhuma migration pendente.')
    return
  }

  console.log(`\n${pending.length} migration(s) pendente(s):`)
  for (const v of pending) console.log(`  + ${v}`)

  if (dryRun) {
    console.log('\nDry-run — nenhuma alteração foi aplicada.\n')
    return
  }

  for (const version of pending) {
    const filePath = join(MIGRATIONS_DIR, `${version}.sql`)
    const content = await readFile(filePath, 'utf-8')
    const checksum = checksumOf(content)

    process.stdout.write(`\nAplicando: ${version} ... `)
    await sql.begin(async tx => {
      await tx.unsafe(content)
      await tx`
        INSERT INTO public.schema_migrations (version, checksum)
        VALUES (${version}, ${checksum})
      `
    })
    console.log('✓')
  }

  console.log('\nTodas as migrations foram aplicadas.\n')
}

async function cmdDown(sql: postgres.Sql, version: string, dryRun: boolean): Promise<void> {
  if (!version) {
    console.error('Erro: informe a versão para reverter. Ex: migrate down 012_user_activation')
    process.exit(1)
  }

  const applied = await getApplied(sql)
  if (!applied.has(version)) {
    console.error(`Erro: migration "${version}" não está marcada como aplicada.`)
    process.exit(1)
  }

  const downFile = join(MIGRATIONS_DIR, `${version}.down.sql`)
  let content: string
  try {
    content = await readFile(downFile, 'utf-8')
  } catch {
    console.error(`Erro: arquivo ${version}.down.sql não encontrado.`)
    process.exit(1)
  }

  if (dryRun) {
    console.log(`Dry-run — reverteria: ${version}\n`)
    return
  }

  process.stdout.write(`\nRevertendo: ${version} ... `)
  await sql.begin(async tx => {
    await tx.unsafe(content)
    await tx`DELETE FROM public.schema_migrations WHERE version = ${version}`
  })
  console.log('✓\n')
}

async function cmdBaseline(sql: postgres.Sql, dryRun: boolean): Promise<void> {
  const files = await getMigrationFiles()
  const applied = await getApplied(sql)

  console.log('\nBaseline — marcando migrations como aplicadas sem executá-las:')
  hr()

  for (const version of files) {
    if (applied.has(version)) {
      console.log(`  = ${version} (já registrada)`)
      continue
    }

    const filePath = join(MIGRATIONS_DIR, `${version}.sql`)
    const content = await readFile(filePath, 'utf-8')
    const checksum = checksumOf(content)

    if (dryRun) {
      console.log(`  + ${version} (seria registrada)`)
      continue
    }

    await sql`
      INSERT INTO public.schema_migrations (version, checksum)
      VALUES (${version}, ${checksum})
      ON CONFLICT (version) DO NOTHING
    `
    console.log(`  + ${version}`)
  }

  hr()
  if (dryRun) {
    console.log('Dry-run — nenhuma alteração foi aplicada.\n')
  } else {
    console.log('Baseline concluído.\n')
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]
  const dryRun = args.includes('--dry-run')
  const VALID_COMMANDS = ['up', 'down', 'status', 'baseline']

  if (!command || !VALID_COMMANDS.includes(command)) {
    console.error(`Uso: migrate <${VALID_COMMANDS.join('|')}> [version] [--dry-run]`)
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('Erro: variável de ambiente DATABASE_URL não definida.')
    process.exit(1)
  }

  // URLs com Unix socket (ex: postgresql://user:pass@/dbname?host=/cloudsql/...)
  // têm host vazio e falham no parser de URL do Node.js. Detectar e repassar via opções.
  const socketMatch = databaseUrl.match(
    /^(?:postgresql|postgres):\/\/([^:]+):([^@]+)@\/([^?]+)\?host=(.+)$/
  )
  const sql = socketMatch
    ? postgres({
        user: socketMatch[1],
        password: decodeURIComponent(socketMatch[2]),
        database: socketMatch[3],
        host: socketMatch[4],
        max: 1,
      })
    : postgres(databaseUrl, { max: 1 })

  try {
    await bootstrap(sql)

    switch (command) {
      case 'status':
        await cmdStatus(sql)
        break
      case 'up':
        await cmdUp(sql, dryRun)
        break
      case 'down':
        await cmdDown(sql, args[1], dryRun)
        break
      case 'baseline':
        await cmdBaseline(sql, dryRun)
        break
    }
  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error('\nFalha na migration:', err.message)
  process.exit(1)
})
