/// <reference types="@sveltejs/kit" />

import type { AuthUser } from '$lib/server/auth';
import type { DbUser } from '$lib/server/users';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: AuthUser | null;
			dbUser: DbUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
