import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { logAuditEvent } from '$lib/server/audit';
import { getEstimate, approveEstimate } from '$lib/server/estimates';
import { createProjectFromEstimate } from '$lib/server/projects';
import type { EstimateResult } from '$lib/types/estimate';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	if (!locals.dbUser) {
		throw error(401, 'Authentication required');
	}
	const estimate = await getEstimate(params.id, user.uid);

	if (!estimate) {
		return jsonError(404, 'Estimate not found');
	}

	if (estimate.status !== 'done') {
		return jsonError(400, 'Only completed estimates can be approved');
	}

	if (estimate.approved_at) {
		return jsonError(400, 'Estimate already approved');
	}

	if (!estimate.result) {
		return jsonError(400, 'Estimate has no result data');
	}

	let body: { name?: string; scenario?: string } = {};
	try {
		body = await request.json();
	} catch {
		// no body is fine, use defaults
	}

	const projectName = body.name || 'Novo Projeto';
	const scenario = body.scenario || 'moderado';

	await approveEstimate(estimate.id);

	const project = await createProjectFromEstimate(
		estimate.id,
		locals.dbUser.id,
		projectName,
		estimate.result as unknown as EstimateResult,
		scenario
	);

	await logAuditEvent({
		eventType: 'estimate.approved',
		actorId: user.uid,
		resourceType: 'estimate',
		resourceId: estimate.id,
		details: { project_id: project.id, scenario, project_name: projectName },
		ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
		userAgent: request.headers.get('user-agent') ?? undefined,
	});

	return jsonOk({
		status: 'approved',
		estimate_id: estimate.id,
		project_id: project.id,
	});
};
