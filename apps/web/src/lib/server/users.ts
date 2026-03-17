import { env } from '$env/dynamic/private';
import sql from './db';

export interface DbUser {
	id: string;
	firebase_uid: string;
	email: string;
	display_name: string | null;
	full_name: string | null;
	company: string | null;
	role: string | null;
	plan: string;
	active: boolean;
	is_admin: boolean;
	onboarding_complete: boolean;
	email_verified: boolean;
	created_at: string;
	updated_at: string;
}

function isAdminEmail(email: string): boolean {
	const adminEmails = (env.ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return adminEmails.includes(email.toLowerCase());
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

	const adminFlag = isAdminEmail(email);
	const [created] = await sql<DbUser[]>`
		INSERT INTO public.users (firebase_uid, email, display_name, is_admin)
		VALUES (${firebaseUid}, ${email}, ${displayName ?? null}, ${adminFlag})
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

export async function updateUserProfile(
	userId: string,
	data: { full_name: string; company?: string; role?: string }
): Promise<DbUser> {
	const [updated] = await sql<DbUser[]>`
		UPDATE public.users
		SET
			full_name = ${data.full_name},
			company   = ${data.company ?? null},
			role      = ${data.role ?? null},
			onboarding_complete = true,
			updated_at = now()
		WHERE id = ${userId}
		RETURNING *
	`;
	return updated;
}

export async function setUserEmailVerified(firebaseUid: string): Promise<void> {
	await sql`
		UPDATE public.users
		SET email_verified = true, updated_at = now()
		WHERE firebase_uid = ${firebaseUid}
	`;
}

export async function setUserActive(userId: string, active: boolean): Promise<DbUser> {
	const [updated] = await sql<DbUser[]>`
		UPDATE public.users
		SET active = ${active}, updated_at = now()
		WHERE id = ${userId}
		RETURNING *
	`;
	return updated;
}

export async function getAllUsers(): Promise<DbUser[]> {
	return sql<DbUser[]>`
		SELECT * FROM public.users ORDER BY created_at DESC
	`;
}
