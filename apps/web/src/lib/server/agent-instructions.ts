import sql from './db';

export interface AgentInstruction {
	id: string;
	agent_key: string;
	title: string;
	content: string;
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
	content: string,
	updatedBy: string
): Promise<AgentInstruction | null> {
	const rows = await sql<AgentInstruction[]>`
		UPDATE public.agent_instructions
		SET content = ${content}, updated_by = ${updatedBy}
		WHERE agent_key = ${agentKey}
		RETURNING *
	`;
	return rows[0] ?? null;
}
