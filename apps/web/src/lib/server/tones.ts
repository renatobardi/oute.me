import sql from './db';

export interface ConversationTone {
	id: string;
	name: string;
	slug: string;
	action: string;
	is_default: boolean;
}

export async function getAvailableTones(): Promise<ConversationTone[]> {
	try {
		return await sql<ConversationTone[]>`
			SELECT id, name, slug, action, is_default
			FROM public.conversation_tones
			ORDER BY is_default DESC, name
		`;
	} catch (err) {
		console.error('[tones] getAvailableTones failed (migration 011 applied?):', err);
		return [];
	}
}

export async function getUserActiveTone(userId: string): Promise<ConversationTone | null> {
	try {
		const [preference] = await sql<ConversationTone[]>`
			SELECT t.id, t.name, t.slug, t.action, t.is_default
			FROM public.conversation_tones t
			JOIN public.user_tone_preferences p ON p.tone_id = t.id
			WHERE p.user_id = ${userId}
		`;

		if (preference) return preference;

		const [defaultTone] = await sql<ConversationTone[]>`
			SELECT id, name, slug, action, is_default
			FROM public.conversation_tones
			WHERE is_default = true
			LIMIT 1
		`;

		return defaultTone ?? null;
	} catch (err) {
		console.error('[tones] getUserActiveTone failed (migration 011 applied?):', err);
		return null;
	}
}

export async function setUserActiveTone(userId: string, toneId: string): Promise<void> {
	await sql`
		INSERT INTO public.user_tone_preferences (user_id, tone_id)
		VALUES (${userId}, ${toneId})
		ON CONFLICT (user_id)
		DO UPDATE SET tone_id = ${toneId}, updated_at = now()
	`;
}
