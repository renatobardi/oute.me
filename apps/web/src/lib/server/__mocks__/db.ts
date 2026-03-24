/**
 * Mock do módulo db para testes.
 *
 * Uso nos testes:
 *   vi.mock('$lib/server/db', () => import('./__mocks__/db'));
 *
 * setMockResults({ 'trecho da query': [resultado] })
 * A tagged template compara strings raw do template com as chaves para devolver o resultado.
 */

let _mockResults: Record<string, unknown[]> = {};
const _log: Array<{ query: string; result: unknown[] }> = [];

/** Configura resultados por trecho de query. Cada chave é comparada com a query raw. */
export function setMockResults(results: Record<string, unknown[]>): void {
	_mockResults = results;
}

/** Retorna o histórico de queries executadas com seus resultados. */
export function getMockExecutionOrder(): ReadonlyArray<{ query: string; result: unknown[] }> {
	return [..._log];
}

/** Limpa resultados configurados e histórico de execução. */
export function resetMocks(): void {
	_mockResults = {};
	_log.length = 0;
}

const sql = function (
	strings: TemplateStringsArray,
	..._values: unknown[]
): Promise<unknown[]> {
	const query = strings.raw.join('?');
	let result: unknown[] = [];

	for (const [key, value] of Object.entries(_mockResults)) {
		if (query.includes(key)) {
			result = value;
			break;
		}
	}

	_log.push({ query, result });
	return Promise.resolve(result);
} as {
	(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
	json(value: unknown): unknown;
	begin<T>(fn: (tx: typeof sql) => Promise<T>): Promise<T>;
};

sql.json = (value: unknown): unknown => value;

sql.begin = async <T>(fn: (tx: typeof sql) => Promise<T>): Promise<T> => fn(sql);

/** withTransaction chama fn(sql) diretamente, sem transação real. */
export async function withTransaction<T>(fn: (tx: typeof sql) => Promise<T>): Promise<T> {
	return fn(sql);
}

export default sql;
