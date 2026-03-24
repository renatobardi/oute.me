/**
 * Mock database module for testing
 * Provides configurable query results and transaction support
 */

let mockResults: Record<string, unknown[]> = {};
let mockExecutionOrder: Array<{ query: string; result: unknown }> = [];

export function setMockResults(results: Record<string, unknown[]>) {
	mockResults = results;
}

export function setMockQueryExecution(query: string, result: unknown) {
	mockExecutionOrder.push({ query, result });
}

export function getMockExecutionOrder() {
	return mockExecutionOrder;
}

export function resetMocks() {
	mockResults = {};
	mockExecutionOrder = [];
}

/**
 * Tagged template function that simulates postgres sql tagged template
 * Returns configurable results and supports .json() method calls
 */
export const sql = Object.assign(
	function sql(strings: TemplateStringsArray, ...values: unknown[]): unknown[] {
		const query = strings.join('?');

		// If specific results are set for this query, return them
		for (const [key, result] of Object.entries(mockResults)) {
			if (query.includes(key)) {
				return result;
			}
		}

		// Default: return empty array
		return [];
	},
	{
		/**
		 * Simulate the .json() method for JSONB fields
		 */
		json(value: unknown): string {
			return JSON.stringify(value);
		},

		/**
		 * Support sql\`NULL\` syntax
		 */
		get NULL() {
			return null;
		},
	}
);

/**
 * Mock transaction handler - calls the callback with the same mock sql object
 */
export async function withTransaction<T>(
	fn: (tx: typeof sql) => Promise<T>
): Promise<T> {
	return fn(sql);
}

export default sql;
