import type { RequestHandler } from './$types';
import { requireAuth, jsonOk } from '$lib/server/api-utils';
import { getProjectsByUser } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	const projects = await getProjectsByUser(locals.dbUser!.id);
	return jsonOk(projects);
};
