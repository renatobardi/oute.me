export type ScenarioName = 'conservador' | 'moderado' | 'otimista';

export interface CostScenario {
	name: ScenarioName;
	description: string;
	total_hours: number;
	hourly_rate: number;
	total_cost: number;
	duration_weeks: number;
	team_size: number;
	confidence: number;
	currency: string;
	risk_buffer_percent: number;
}

export interface Milestone {
	name: string;
	description: string;
	duration_weeks: number;
	deliverables: string[];
	dependencies: string[];
}

export interface TechRecommendation {
	category: string;
	technology: string;
	justification: string;
}

export interface RiskItem {
	description: string;
	impact: string;
	mitigation: string;
	probability: string;
}

export interface EstimateResult {
	summary: string;
	architecture_overview: string;
	milestones: Milestone[];
	cost_scenarios: CostScenario[];
	tech_recommendations: TechRecommendation[];
	risks: RiskItem[];
	similar_projects: Record<string, unknown>[];
	executive_summary: string;
}

export interface AgentStep {
	agent_key: string;
	status: string; // pending | running | done | failed
	started_at: string | null;
	finished_at: string | null;
	duration_s: number | null;
	output_preview: string | null;
	error: string | null;
	llm_model: string | null;
	input_tokens: number | null;
	output_tokens: number | null;
}

export const AGENT_LABELS: Record<string, string> = {
	architecture_interviewer: 'Entrevistador de Arquitetura',
	rag_analyst: 'Analista RAG',
	software_architect: 'Arquiteto de Software',
	cost_specialist: 'Especialista em Custos',
	reviewer: 'Revisor e Apresentador',
	knowledge_manager: 'Gestor de Conhecimento',
};

export const AGENT_KEYS = Object.keys(AGENT_LABELS);

export interface Estimate {
	id: string;
	interview_id: string;
	user_id: string;
	status: string;
	job_id: string | null;
	result: EstimateResult | null;
	agent_steps: AgentStep[];
	approved_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface EstimateRun {
	id: string;
	estimate_id: string;
	job_id: string;
	status: string;
	llm_model: string | null;
	agent_steps: AgentStep[];
	agent_outputs: Record<string, unknown>;
	total_duration_s: number | null;
	error_message: string | null;
	created_at: Date;
	completed_at: Date | null;
}
