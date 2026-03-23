import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateUuid } from '$lib/server/api-utils';
import sql from '$lib/server/db';
import type { EstimateRun, AgentStep } from '$lib/types/estimate';

interface RunRow extends EstimateRun {
	run_id: string;
}

function diffAgentOutputs(
	outA: Record<string, unknown>,
	outB: Record<string, unknown>
): { changed: boolean; fields: string[] } {
	const allKeys = new Set([...Object.keys(outA), ...Object.keys(outB)]);
	const changedFields: string[] = [];

	for (const key of allKeys) {
		if (JSON.stringify(outA[key]) !== JSON.stringify(outB[key])) {
			changedFields.push(key);
		}
	}

	return { changed: changedFields.length > 0, fields: changedFields };
}

export const GET: RequestHandler = async ({ locals, url, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const runAId = url.searchParams.get('a');
	const runBId = url.searchParams.get('b');

	if (!runAId || !runBId) throw error(400, 'Parâmetros a e b obrigatórios');
	if (runAId === runBId) throw error(400, 'Runs devem ser diferentes');
	validateUuid(params.id);
	validateUuid(runAId);
	validateUuid(runBId);

	const interviewId = params.id;

	const runs = await sql<RunRow[]>`
		SELECT er.*
		FROM public.estimate_runs er
		JOIN public.estimates e ON e.id = er.estimate_id
		WHERE e.interview_id = ${interviewId}
		  AND er.id IN (${runAId}, ${runBId})
	`;

	if (runs.length < 2) throw error(404, 'Uma ou mais runs não encontradas');

	const runA = runs.find((r) => r.id === runAId);
	const runB = runs.find((r) => r.id === runBId);
	if (!runA || !runB) throw error(404, 'Uma ou ambas as runs não encontradas');

	const agentOutputsA = (runA.agent_outputs ?? {}) as Record<string, Record<string, unknown>>;
	const agentOutputsB = (runB.agent_outputs ?? {}) as Record<string, Record<string, unknown>>;

	const allAgentKeys = new Set([...Object.keys(agentOutputsA), ...Object.keys(agentOutputsB)]);
	const diffs: Record<string, { changed: boolean; fields: string[] }> = {};

	for (const agentKey of allAgentKeys) {
		diffs[agentKey] = diffAgentOutputs(
			agentOutputsA[agentKey] ?? {},
			agentOutputsB[agentKey] ?? {}
		);
	}

	// Duration deltas per agent step
	const stepsA = (runA.agent_steps ?? []) as AgentStep[];
	const stepsB = (runB.agent_steps ?? []) as AgentStep[];

	const stepDurations: Record<string, { a: number | null; b: number | null; delta: number | null }> = {};
	for (const step of stepsA) {
		stepDurations[step.agent_key] = { a: step.duration_s, b: null, delta: null };
	}
	for (const step of stepsB) {
		if (!stepDurations[step.agent_key]) {
			stepDurations[step.agent_key] = { a: null, b: step.duration_s, delta: null };
		} else {
			stepDurations[step.agent_key].b = step.duration_s;
		}
		const entry = stepDurations[step.agent_key];
		if (entry.a != null && entry.b != null) {
			entry.delta = entry.b - entry.a;
		}
	}

	// Cost scenario deltas
	const costsA = (agentOutputsA['cost_specialist']?.cost_scenarios ?? []) as Array<{ name: string; total_cost: number }>;
	const costsB = (agentOutputsB['cost_specialist']?.cost_scenarios ?? []) as Array<{ name: string; total_cost: number }>;

	const costDelta: Record<string, { a: number | null; b: number | null; delta_pct: number | null }> = {};
	for (const sc of costsA) {
		costDelta[sc.name] = { a: sc.total_cost, b: null, delta_pct: null };
	}
	for (const sc of costsB) {
		if (!costDelta[sc.name]) {
			costDelta[sc.name] = { a: null, b: sc.total_cost, delta_pct: null };
		} else {
			costDelta[sc.name].b = sc.total_cost;
			const entry = costDelta[sc.name];
			if (entry.a != null && entry.b != null && entry.a !== 0) {
				entry.delta_pct = Math.round(((entry.b - entry.a) / entry.a) * 100);
			}
		}
	}

	const changedAgentsCount = Object.values(diffs).filter((d) => d.changed).length;

	return json({
		run_a: runA,
		run_b: runB,
		diffs,
		step_durations: stepDurations,
		cost_delta: costDelta,
		summary: {
			changed_agents: changedAgentsCount,
			total_agents: allAgentKeys.size,
			duration_a: runA.total_duration_s,
			duration_b: runB.total_duration_s,
			duration_delta: runA.total_duration_s != null && runB.total_duration_s != null
				? runB.total_duration_s - runA.total_duration_s
				: null,
		},
	});
};
