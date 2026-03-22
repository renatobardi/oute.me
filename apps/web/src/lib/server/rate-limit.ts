import sql from './db';

/**
 * Rate limit check usando PostgreSQL.
 * Retorna true se o request é permitido, false se limitado.
 */
export async function checkRateLimit(key: string, windowMs = 2000): Promise<boolean> {
	const result = await sql`
		INSERT INTO public.rate_limits (key, last_request_at)
		VALUES (${key}, NOW())
		ON CONFLICT (key) DO UPDATE
			SET last_request_at = NOW()
			WHERE rate_limits.last_request_at
			      < NOW() - INTERVAL '1 millisecond' * ${windowMs}
		RETURNING key
	`;
	// Se retornou row, o upsert aconteceu (request permitido).
	// Se não retornou, o WHERE falhou (dentro da janela — limitado).
	return result.length > 0;
}

/**
 * Cleanup periódico de entries antigas.
 * Chamar via scheduled task ou no health check.
 */
export async function cleanupRateLimits(): Promise<void> {
	await sql`
		DELETE FROM public.rate_limits
		WHERE last_request_at < NOW() - INTERVAL '1 hour'
	`;
}
