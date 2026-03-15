import type { RequestHandler } from './$types';
import { requireAuth, jsonOk } from '$lib/server/api-utils';
import { getProjectsByUser } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals);
	const projects = await getProjectsByUser(user.uid);
	return jsonOk(projects);
};
