export interface DomainState {
	answered: number;
	total: number;
	vital_answered: boolean;
}

export interface InterviewState {
	project_type: string;
	setup_confirmed: boolean;
	domains: Record<string, DomainState>;
	responses: Record<string, { value: string; source: string; confirmed: boolean }>;
	open_questions: string[];
	documents_processed: string[];
	conversation_summary: string;
	last_questions_asked: string[];
}

export interface Interview {
	id: string;
	user_id: string;
	title: string | null;
	status: string;
	state: InterviewState;
	maturity: number;
	created_at: Date;
	updated_at: Date;
}

export interface InterviewMessage {
	id: string;
	interview_id: string;
	role: string;
	content: string;
	tokens_used: number;
	created_at: Date;
}

export interface InterviewDocument {
	id: string;
	interview_id: string;
	filename: string;
	mime_type: string;
	storage_path: string;
	file_hash: string | null;
	extracted_text: string | null;
	status: string;
	created_at: Date;
}

export const DOMAIN_WEIGHTS: Record<string, number> = {
	scope: 0.3,
	timeline: 0.2,
	budget: 0.2,
	integrations: 0.15,
	tech_stack: 0.15,
};

export const VITAL_REQUIRED: Record<string, boolean> = {
	scope: true,
	timeline: true,
	budget: true,
	integrations: false,
	tech_stack: true,
};

export const MATURITY_THRESHOLD = 0.7;

export function createDefaultState(): InterviewState {
	return {
		project_type: 'new',
		setup_confirmed: false,
		domains: {
			scope: { answered: 0, total: 8, vital_answered: false },
			timeline: { answered: 0, total: 5, vital_answered: false },
			budget: { answered: 0, total: 4, vital_answered: false },
			integrations: { answered: 0, total: 6, vital_answered: false },
			tech_stack: { answered: 0, total: 5, vital_answered: false },
		},
		responses: {},
		open_questions: [],
		documents_processed: [],
		conversation_summary: '',
		last_questions_asked: [],
	};
}

export function calculateMaturity(state: InterviewState): number {
	const { domains } = state;
	let score = 0;

	for (const [domain, weight] of Object.entries(DOMAIN_WEIGHTS)) {
		const d = domains[domain];
		if (!d) continue;
		const progress = d.total > 0 ? Math.min(d.answered / d.total, 1.0) : 0;
		score += weight * progress;
	}

	const allVitalAnswered = Object.entries(VITAL_REQUIRED).every(([domain, required]) => {
		if (!required) return true;
		return domains[domain]?.vital_answered ?? false;
	});

	if (!allVitalAnswered) {
		score *= 0.85;
	}

	return Math.round(score * 1000) / 1000;
}
