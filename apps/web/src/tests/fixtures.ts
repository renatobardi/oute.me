import { randomUUID } from 'crypto';
import type {
	Interview,
	InterviewState,
	InterviewMessage,
	InterviewDocument,
} from '$lib/types/interview';
import type { Estimate, EstimateRun } from '$lib/types/estimate';
import type { Project, ProjectMilestone, ProjectTask } from '$lib/types/project';

/**
 * Test fixtures/factories for creating mock domain objects
 */

export interface AuthUser {
	uid: string;
	email: string;
	name?: string;
	emailVerified: boolean;
}

/**
 * Create a mock AuthUser object
 */
export function createMockUser(overrides?: Partial<AuthUser>): AuthUser {
	return {
		uid: 'user-' + randomUUID(),
		email: 'test@example.com',
		name: 'Test User',
		emailVerified: true,
		...overrides,
	};
}

/**
 * Create a default interview state
 */
export function createDefaultInterviewState(): InterviewState {
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

/**
 * Create a mock Interview object
 */
export function createMockInterview(overrides?: Partial<Interview>): Interview {
	const now = new Date();
	return {
		id: 'interview-' + randomUUID(),
		user_id: 'user-' + randomUUID(),
		title: 'Sample Project',
		status: 'in_progress',
		state: createDefaultInterviewState(),
		maturity: 0.5,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/**
 * Create a mock InterviewMessage object
 */
export function createMockMessage(overrides?: Partial<InterviewMessage>): InterviewMessage {
	return {
		id: 'msg-' + randomUUID(),
		interview_id: 'interview-' + randomUUID(),
		role: 'assistant',
		content: 'Sample response',
		tokens_used: 100,
		created_at: new Date(),
		...overrides,
	};
}

/**
 * Create a mock InterviewDocument object
 */
export function createMockDocument(overrides?: Partial<InterviewDocument>): InterviewDocument {
	return {
		id: 'doc-' + randomUUID(),
		interview_id: 'interview-' + randomUUID(),
		filename: 'requirements.pdf',
		mime_type: 'application/pdf',
		storage_path: 'gs://bucket/file.pdf',
		file_hash: 'hash123',
		extracted_text: 'Sample text content',
		status: 'processed',
		created_at: new Date(),
		...overrides,
	};
}

/**
 * Create a mock CostScenario
 */
export function createMockCostScenario(name: 'conservador' | 'moderado' | 'otimista' = 'moderado') {
	const baseHours = 500;
	const baseRate = 150;

	let hours: number;
	let rate: number;
	let riskBuffer: number;

	switch (name) {
		case 'conservador':
			hours = baseHours * 1.3;
			rate = baseRate;
			riskBuffer = 30;
			break;
		case 'otimista':
			hours = baseHours * 0.8;
			rate = baseRate;
			riskBuffer = 10;
			break;
		default: // moderado
			hours = baseHours;
			rate = baseRate;
			riskBuffer = 20;
	}

	return {
		name,
		description: `${name.charAt(0).toUpperCase() + name.slice(1)} estimate`,
		total_hours: hours,
		hourly_rate: rate,
		total_cost: hours * rate,
		duration_weeks: Math.ceil(hours / 40),
		team_size: 3,
		confidence: name === 'moderado' ? 0.85 : name === 'conservador' ? 0.9 : 0.75,
		currency: 'USD',
		risk_buffer_percent: riskBuffer,
	};
}

/**
 * Create a mock Milestone
 */
export function createMockMilestone(overrides?: Record<string, unknown>) {
	return {
		name: 'Phase 1: Discovery',
		description: 'Initial requirements gathering and design',
		duration_weeks: 3,
		deliverables: ['Requirements document', 'Design mockups'],
		dependencies: [],
		...overrides,
	};
}

/**
 * Create a mock EstimateResult
 */
export function createMockEstimateResult(overrides?: Record<string, unknown>) {
	return {
		summary: 'This is a web application requiring...',
		architecture_overview: 'Modern SPA with Node.js backend',
		milestones: [
			createMockMilestone(),
			{
				name: 'Phase 2: Development',
				description: 'Core feature implementation',
				duration_weeks: 8,
				deliverables: ['API endpoints', 'Frontend components'],
				dependencies: ['Phase 1: Discovery'],
			},
		],
		cost_scenarios: [
			createMockCostScenario('conservador'),
			createMockCostScenario('moderado'),
			createMockCostScenario('otimista'),
		],
		tech_recommendations: [
			{
				category: 'Backend',
				technology: 'Node.js',
				justification: 'Suitable for real-time applications',
			},
		],
		risks: [
			{
				description: 'Scope creep',
				impact: 'High',
				mitigation: 'Weekly scope reviews',
				probability: 'Medium',
			},
		],
		similar_projects: [
			{ id: 'proj1', name: 'Similar Project 1', match: 0.85 },
		],
		executive_summary: 'This project requires approximately 500 hours...',
		...overrides,
	};
}

/**
 * Create a mock Estimate object
 */
export function createMockEstimate(overrides?: Partial<Estimate>): Estimate {
	const now = new Date();
	return {
		id: 'estimate-' + randomUUID(),
		interview_id: 'interview-' + randomUUID(),
		user_id: 'user-' + randomUUID(),
		status: 'pending',
		job_id: null,
		result: null,
		agent_steps: [],
		approved_at: null,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/**
 * Create a mock EstimateRun object
 */
export function createMockEstimateRun(overrides?: Partial<EstimateRun>): EstimateRun {
	const now = new Date();
	return {
		id: 'run-' + randomUUID(),
		estimate_id: 'estimate-' + randomUUID(),
		job_id: 'job-' + randomUUID(),
		status: 'pending',
		llm_model: 'gemini-2.5-flash-lite',
		agent_steps: [],
		agent_outputs: {},
		total_duration_s: null,
		error_message: null,
		created_at: now,
		completed_at: null,
		...overrides,
	};
}

/**
 * Create a mock Project object
 */
export function createMockProject(overrides?: Partial<Project>): Project {
	const now = new Date();
	return {
		id: 'project-' + randomUUID(),
		estimate_id: 'estimate-' + randomUUID(),
		user_id: 'user-' + randomUUID(),
		name: 'Sample Project',
		description: 'A sample project description',
		status: 'active',
		selected_scenario: 'moderado',
		total_cost: 75000,
		total_hours: 500,
		duration_weeks: 13,
		team_size: 3,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/**
 * Create a mock ProjectMilestone object
 */
export function createMockProjectMilestone(
	overrides?: Partial<ProjectMilestone>
): ProjectMilestone {
	const now = new Date();
	return {
		id: 'milestone-' + randomUUID(),
		project_id: 'project-' + randomUUID(),
		name: 'Phase 1',
		description: 'Initial development phase',
		duration_weeks: 3,
		sort_order: 0,
		status: 'pending',
		deliverables: ['Design', 'API'],
		dependencies: [],
		started_at: null,
		completed_at: null,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/**
 * Create a mock ProjectTask object
 */
export function createMockProjectTask(overrides?: Partial<ProjectTask>): ProjectTask {
	const now = new Date();
	return {
		id: 'task-' + randomUUID(),
		milestone_id: 'milestone-' + randomUUID(),
		project_id: 'project-' + randomUUID(),
		title: 'Build API',
		description: 'Implement REST API',
		status: 'pending',
		priority: 'high',
		estimated_hours: 40,
		sort_order: 0,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/**
 * Create a mock SvelteKit RequestEvent.
 * Por padrão inclui Bearer token no header — sobrescreva request.headers.get para testar sem auth.
 */
export function createMockRequestEvent(overrides?: Record<string, unknown>) {
	return {
		request: {
			headers: {
				get: (name: string): string | null => {
					if (name.toLowerCase() === 'authorization') return 'Bearer test-token';
					return null;
				},
			},
			method: 'GET',
			url: 'http://localhost:5173/api/test',
		},
		cookies: {
			get: (name: string): string | undefined => {
				if (name === '__session') return 'test-session-cookie';
				return undefined;
			},
			set: () => {},
			delete: () => {},
			getAll: () => [],
			serialize: () => '',
		},
		params: {},
		locals: {},
		...overrides,
	} as unknown as import('@sveltejs/kit').RequestEvent;
}
