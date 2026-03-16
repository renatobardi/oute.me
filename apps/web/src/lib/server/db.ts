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

export default sql;
