import postgres from 'postgres';
import { env } from '$env/dynamic/private';

function createConnection() {
	const url = env.DATABASE_URL || '';

	// Cloud SQL Unix socket format: postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
	const socketMatch = url.match(/\?host=(.+)$/);
	if (socketMatch) {
		const socketPath = socketMatch[1];
		const baseUrl = url.replace(/\?host=.+$/, '');
		return postgres(baseUrl, {
			max: 10,
			idle_timeout: 20,
			connect_timeout: 10,
			host: socketPath,
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
