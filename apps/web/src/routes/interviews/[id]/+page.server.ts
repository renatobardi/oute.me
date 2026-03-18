import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, getMessages, getDocuments } from '$lib/server/interviews';
import { getUserActiveTone } from '$lib/server/tones';
import { warmUpAiService } from '$lib/server/ai-client';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// Warm up the AI service in the background while DB queries run.
	// If the container is scaled to zero, this gives it a head start
	// before the user sends their first message.
	warmUpAiService();

	const user = await getOrCreateUser(locals.user.uid, locals.user.email, locals.user.name);
	const interview = await getInterview(params.id, user.id);

	if (!interview) {
		throw error(404, 'Entrevista não encontrada');
	}

	const [messages, documents, activeTone] = await Promise.all([
		getMessages(params.id),
		getDocuments(params.id),
		getUserActiveTone(user.id),
	]);

	return { interview, messages, documents, toneAction: activeTone?.action ?? null };
};
