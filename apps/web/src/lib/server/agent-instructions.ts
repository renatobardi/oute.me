import sql from './db';

export interface AgentInstruction {
	id: string;
	agent_key: string;
	title: string;
	content: string;
	temperature: number;
	max_tokens: number;
	enabled: boolean;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

export async function getAllInstructions(): Promise<AgentInstruction[]> {
	return sql<AgentInstruction[]>`
		SELECT * FROM public.agent_instructions
		ORDER BY agent_key
	`;
}

export async function getInstruction(agentKey: string): Promise<AgentInstruction | null> {
	const rows = await sql<AgentInstruction[]>`
		SELECT * FROM public.agent_instructions
		WHERE agent_key = ${agentKey}
	`;
	return rows[0] ?? null;
}

export async function updateInstruction(
	agentKey: string,
	fields: { content?: string; temperature?: number; max_tokens?: number; enabled?: boolean },
	updatedBy: string
): Promise<AgentInstruction | null> {
	const current = await getInstruction(agentKey);
	if (!current) return null;

	const content = fields.content ?? current.content;
	const temperature = fields.temperature ?? current.temperature;
	const max_tokens = fields.max_tokens ?? current.max_tokens;
	const enabled = fields.enabled ?? current.enabled;

	const rows = await sql<AgentInstruction[]>`
		UPDATE public.agent_instructions
		SET content      = ${content},
		    temperature  = ${temperature},
		    max_tokens   = ${max_tokens},
		    enabled      = ${enabled},
		    updated_by   = ${updatedBy}
		WHERE agent_key = ${agentKey}
		RETURNING *
	`;
	return rows[0] ?? null;
}
