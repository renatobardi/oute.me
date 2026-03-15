import sql from './db';

interface DbUser {
	id: string;
	firebase_uid: string;
	email: string;
	display_name: string | null;
	plan: string;
}

export async function getOrCreateUser(
	firebaseUid: string,
	email: string,
	displayName?: string
): Promise<DbUser> {
	const [existing] = await sql<DbUser[]>`
		SELECT * FROM public.users WHERE firebase_uid = ${firebaseUid}
	`;
	if (existing) return existing;

	const [created] = await sql<DbUser[]>`
		INSERT INTO public.users (firebase_uid, email, display_name)
		VALUES (${firebaseUid}, ${email}, ${displayName ?? null})
		RETURNING *
	`;
	return created;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<DbUser | null> {
	const [row] = await sql<DbUser[]>`
		SELECT * FROM public.users WHERE firebase_uid = ${firebaseUid}
	`;
	return row ?? null;
}
