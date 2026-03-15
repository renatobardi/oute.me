import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getOrCreateUser } from '$lib/server/users';
import { getInterviewsByUser } from '$lib/server/interviews';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}

	const user = await getOrCreateUser(locals.user.uid, locals.user.email, locals.user.name);
	const interviews = await getInterviewsByUser(user.id);

	return { interviews };
};
