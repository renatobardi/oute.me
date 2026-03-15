export interface CostScenario {
	name: string;
	description: string;
	total_hours: number;
	hourly_rate: number;
	total_cost: number;
	duration_weeks: number;
	team_size: number;
	confidence: number;
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

export interface Estimate {
	id: string;
	interview_id: string;
	user_id: string;
	status: string;
	job_id: string | null;
	result: EstimateResult | null;
	approved_at: Date | null;
	created_at: Date;
	updated_at: Date;
}
