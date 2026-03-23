#!/usr/bin/env tsx
/**
 * backfill-maturity-snapshots.ts
 *
 * Backfill da tabela interview_state_snapshots para entrevistas existentes
 * que foram criadas antes do deploy da migration 020.
 *
 * A migration 020 criou a tabela mas não populou dados históricos.
 * Este script deriva os snapshots a partir do campo `state` de cada
 * mensagem assistant armazenada em interview_messages.
 *
 * Uso:
 *   pnpm tsx scripts/backfill-maturity-snapshots.ts
 *   pnpm tsx scripts/backfill-maturity-snapshots.ts --dry-run
 *   pnpm tsx scripts/backfill-maturity-snapshots.ts --interview-id <uuid>
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('❌  DATABASE_URL não definida. Configure apps/web/.env');
	process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const idxId = args.indexOf('--interview-id');
const SINGLE_ID = idxId !== -1 ? args[idxId + 1] : null;

const sql = postgres(DATABASE_URL, { max: 5 });

interface DomainEntry {
	answered?: number;
	total?: number;
	vital_answered?: boolean;
}

interface InterviewState {
	maturity?: number;
	domains?: Record<string, DomainEntry>;
}

interface MessageRow {
	interview_id: string;
	id: string;
	turn_number: number;
	state_after: InterviewState | null;
}

async function main() {
	console.log(`🔄  Backfill de maturity snapshots${DRY_RUN ? ' [DRY-RUN]' : ''}${SINGLE_ID ? ` — entrevista ${SINGLE_ID}` : ''}`);

	// Busca mensagens com state_after não-nulo, excluindo turnos que já têm snapshot
	const messages = await sql<MessageRow[]>`
		SELECT
			m.interview_id::text,
			m.id::text,
			ROW_NUMBER() OVER (PARTITION BY m.interview_id ORDER BY m.created_at)::int AS turn_number,
			m.state_after
		FROM public.interview_messages m
		WHERE m.role = 'assistant'
		  AND m.state_after IS NOT NULL
		  AND (m.state_after->>'maturity') IS NOT NULL
		  ${SINGLE_ID ? sql`AND m.interview_id = ${SINGLE_ID}::uuid` : sql``}
		  AND NOT EXISTS (
			SELECT 1 FROM public.interview_state_snapshots s
			WHERE s.interview_id = m.interview_id
			  AND s.turn_number = ROW_NUMBER() OVER (PARTITION BY m.interview_id ORDER BY m.created_at)
		  )
		ORDER BY m.interview_id, m.created_at
	`;

	if (messages.length === 0) {
		console.log('✅  Nenhuma mensagem pendente de backfill.');
		await sql.end();
		return;
	}

	console.log(`📋  ${messages.length} mensagem(ns) para processar`);

	let inserted = 0;
	let skipped = 0;

	for (const msg of messages) {
		const state = msg.state_after;
		const maturity = state?.maturity ?? 0;
		const rawDomains = state?.domains ?? {};

		const domains: Record<string, { answered: number; total: number; vital_answered: boolean }> = {};
		for (const [key, d] of Object.entries(rawDomains)) {
			domains[key] = {
				answered: d.answered ?? 0,
				total: d.total ?? 0,
				vital_answered: d.vital_answered ?? false,
			};
		}

		if (DRY_RUN) {
			console.log(
				`  [dry-run] interview=${msg.interview_id} turn=${msg.turn_number} maturity=${(maturity * 100).toFixed(0)}%`
			);
			inserted++;
			continue;
		}

		try {
			await sql`
				INSERT INTO public.interview_state_snapshots
					(interview_id, message_id, turn_number, maturity, domains)
				VALUES
					(${msg.interview_id}::uuid, ${msg.id}::uuid, ${msg.turn_number}, ${maturity}, ${sql.json(domains)})
				ON CONFLICT DO NOTHING
			`;
			inserted++;
		} catch (err) {
			console.warn(`  ⚠️  Falha ao inserir turn ${msg.turn_number} da entrevista ${msg.interview_id}:`, err);
			skipped++;
		}
	}

	console.log(`\n✅  Concluído: ${inserted} inserido(s), ${skipped} ignorado(s).`);
	await sql.end();
}

main().catch((err) => {
	console.error('❌  Erro fatal:', err);
	process.exit(1);
});
