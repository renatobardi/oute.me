import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, getMessages, getDocuments } from '$lib/server/interviews';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}

	const user = await getOrCreateUser(locals.user.uid, locals.user.email, locals.user.name);
	const interview = await getInterview(params.id, user.id);

	if (!interview) {
		throw error(404, 'Entrevista não encontrada');
	}

	const [messages, documents] = await Promise.all([
		getMessages(params.id),
		getDocuments(params.id),
	]);

	return { interview, messages, documents };
};
