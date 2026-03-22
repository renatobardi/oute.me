import postgres from 'postgres';
import { env } from '$env/dynamic/private';

function createConnection() {
	const url = env.DATABASE_URL || '';

	// Cloud SQL Unix socket: postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
	const socketMatch = url.match(
		/^postgresql:\/\/([^:]+):([^@]+)@\/([^?]+)\?host=(.+)$/
	);
	if (socketMatch) {
		const [, username, password, database, socketPath] = socketMatch;
		return postgres({
			username,
			password,
			database,
			host: socketPath,
			max: 10,
			idle_timeout: 20,
			connect_timeout: 10,
		});
	}

	return postgres(url, {
		max: 10,
		idle_timeout: 20,
		connect_timeout: 10,
	});
}

const sql = createConnection();

// postgres.TransactionSql extends Omit<Sql,...> which loses the call signature.
// We type the callback param as `typeof sql` so callers can use tagged templates,
// then cast to satisfy sql.begin's narrower expected type.
export async function withTransaction<T>(
	fn: (tx: typeof sql) => Promise<T>
): Promise<T> {
	return sql.begin(fn as unknown as (tx: postgres.TransactionSql) => Promise<T>) as unknown as Promise<T>;
}

export default sql;
