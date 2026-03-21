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
	const adminFlag = isAdminEmail(email);

	const [row] = await sql<DbUser[]>`
		INSERT INTO public.users (firebase_uid, email, display_name, is_admin, active, onboarding_complete, email_verified)
		VALUES (${firebaseUid}, ${email}, ${displayName ?? null}, ${adminFlag}, ${adminFlag}, ${adminFlag}, ${adminFlag})
		ON CONFLICT (firebase_uid) DO UPDATE SET
			email               = EXCLUDED.email,
			display_name        = COALESCE(EXCLUDED.display_name, public.users.display_name),
			is_admin            = ${adminFlag},
			updated_at          = now()
		RETURNING *
	`;
	return row;
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
