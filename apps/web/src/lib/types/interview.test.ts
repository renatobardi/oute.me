import { describe, it, expect } from 'vitest';
import {
	createDefaultState,
	calculateMaturity,
	MATURITY_THRESHOLD,
	DOMAIN_WEIGHTS,
	VITAL_REQUIRED,
	type InterviewState,
} from './interview';

describe('interview types (pure functions)', () => {
	describe('createDefaultState', () => {
		it('returns valid state with all 5 domains', () => {
			const state = createDefaultState();

			expect(state.domains).toHaveProperty('scope');
			expect(state.domains).toHaveProperty('timeline');
			expect(state.domains).toHaveProperty('budget');
			expect(state.domains).toHaveProperty('integrations');
			expect(state.domains).toHaveProperty('tech_stack');
		});

		it('has all domains with answered=0', () => {
			const state = createDefaultState();

			Object.values(state.domains).forEach((domain) => {
				expect(domain.answered).toBe(0);
			});
		});

		it('has correct total answers per domain', () => {
			const state = createDefaultState();

			expect(state.domains.scope.total).toBe(8);
			expect(state.domains.timeline.total).toBe(5);
			expect(state.domains.budget.total).toBe(4);
			expect(state.domains.integrations.total).toBe(6);
			expect(state.domains.tech_stack.total).toBe(5);
		});

		it('has all vital_answered=false', () => {
			const state = createDefaultState();

			Object.values(state.domains).forEach((domain) => {
				expect(domain.vital_answered).toBe(false);
			});
		});

		it('has empty responses, open_questions, documents_processed', () => {
			const state = createDefaultState();

			expect(state.responses).toEqual({});
			expect(state.open_questions).toEqual([]);
			expect(state.documents_processed).toEqual([]);
		});

		it('has setup_confirmed=false', () => {
			const state = createDefaultState();

			expect(state.setup_confirmed).toBe(false);
		});

		it('has project_type="new"', () => {
			const state = createDefaultState();

			expect(state.project_type).toBe('new');
		});
	});

	describe('calculateMaturity', () => {
		it('returns 0 for fresh state (all answered=0, no vitals)', () => {
			const state = createDefaultState();

			const maturity = calculateMaturity(state);

			expect(maturity).toBe(0);
		});

		it('returns 1.0 when all domains fully answered with vitals', () => {
			const state = createDefaultState();

			// Set all domains to fully answered and vitals confirmed
			state.domains.scope = { answered: 8, total: 8, vital_answered: true };
			state.domains.timeline = { answered: 5, total: 5, vital_answered: true };
			state.domains.budget = { answered: 4, total: 4, vital_answered: true };
			state.domains.integrations = { answered: 6, total: 6, vital_answered: true };
			state.domains.tech_stack = { answered: 5, total: 5, vital_answered: true };

			const maturity = calculateMaturity(state);

			expect(maturity).toBe(1.0);
		});

		it('applies 0.85 penalty when vital domains not answered', () => {
			const state = createDefaultState();

			// Set all domains to fully answered BUT vital_answered=false
			state.domains.scope = { answered: 8, total: 8, vital_answered: false };
			state.domains.timeline = { answered: 5, total: 5, vital_answered: false };
			state.domains.budget = { answered: 4, total: 4, vital_answered: false };
			state.domains.integrations = { answered: 6, total: 6, vital_answered: true };
			state.domains.tech_stack = { answered: 5, total: 5, vital_answered: false };

			const maturity = calculateMaturity(state);

			// Without penalty would be 1.0, with penalty = 1.0 * 0.85 = 0.85
			expect(maturity).toBe(0.85);
		});

		it('handles missing domains gracefully', () => {
			const state: InterviewState = {
				project_type: 'new',
				setup_confirmed: false,
				domains: {
					scope: { answered: 5, total: 8, vital_answered: true },
					// timeline, budget, integrations, tech_stack missing
				} as unknown as InterviewState['domains'],
				responses: {},
				open_questions: [],
				documents_processed: [],
				conversation_summary: '',
				last_questions_asked: [],
			};

			const maturity = calculateMaturity(state);

			// Only scope contributes: 5/8 * 0.3 = 0.1875
			// With vital answered: 0.1875 (no penalty as other vitals are missing)
			expect(maturity).toBeGreaterThanOrEqual(0);
			expect(maturity).toBeLessThanOrEqual(1);
		});

		it('with partial progress returns correct weighted score', () => {
			const state = createDefaultState();

			// Partial progress on each domain
			state.domains.scope = { answered: 4, total: 8, vital_answered: true }; // 50% = 0.5
			state.domains.timeline = { answered: 2, total: 5, vital_answered: false }; // 40% = 0.4
			state.domains.budget = { answered: 2, total: 4, vital_answered: true }; // 50% = 0.5
			state.domains.integrations = { answered: 3, total: 6, vital_answered: false }; // 50% = 0.5
			state.domains.tech_stack = { answered: 3, total: 5, vital_answered: true }; // 60% = 0.6

			const maturity = calculateMaturity(state);

			// Calculate expected: 0.5*0.3 + 0.4*0.2 + 0.5*0.2 + 0.5*0.15 + 0.6*0.15
			// = 0.15 + 0.08 + 0.1 + 0.075 + 0.09 = 0.495
			// timeline and integrations are not vital but missing vital flag
			// Only scope, budget, tech_stack have vital_answered=true
			// So penalty applies: 0.495 * 0.85 = 0.42075
			expect(Math.abs(maturity - 0.42075) < 0.001).toBe(true);
		});

		it('respects domain weights in calculation', () => {
			const state = createDefaultState();

			// Only scope fully answered
			state.domains.scope = { answered: 8, total: 8, vital_answered: true };
			state.domains.timeline = { answered: 0, total: 5, vital_answered: false };
			state.domains.budget = { answered: 0, total: 4, vital_answered: false };
			state.domains.integrations = { answered: 0, total: 6, vital_answered: false };
			state.domains.tech_stack = { answered: 0, total: 5, vital_answered: false };

			const maturity = calculateMaturity(state);

			// scope = 1.0 * 0.3 = 0.3, others = 0
			// timeline, budget, tech_stack are vital but not answered, so penalty applies
			// 0.3 * 0.85 = 0.255
			expect(Math.abs(maturity - 0.255) < 0.001).toBe(true);
		});

		it('returns 0 for domain with total=0 (avoids division by zero)', () => {
			const state = createDefaultState();

			// Override scope with total=0
			state.domains.scope = { answered: 0, total: 0, vital_answered: false };
			state.domains.timeline = { answered: 0, total: 5, vital_answered: false };
			state.domains.budget = { answered: 0, total: 4, vital_answered: false };
			state.domains.integrations = { answered: 0, total: 6, vital_answered: false };
			state.domains.tech_stack = { answered: 0, total: 5, vital_answered: false };

			const maturity = calculateMaturity(state);

			// scope contributes 0 (total=0 → progress=0), others also 0
			expect(maturity).toBe(0);
		});

		it('handles max answered > total (capped at 1.0 per domain)', () => {
			const state = createDefaultState();

			state.domains.scope = { answered: 10, total: 8, vital_answered: true }; // Should cap at 1.0
			state.domains.timeline = { answered: 5, total: 5, vital_answered: true };
			state.domains.budget = { answered: 4, total: 4, vital_answered: true };
			state.domains.integrations = { answered: 6, total: 6, vital_answered: true };
			state.domains.tech_stack = { answered: 5, total: 5, vital_answered: true };

			const maturity = calculateMaturity(state);

			// Should be capped at 1.0
			expect(maturity).toBe(1.0);
		});
	});

	describe('MATURITY_THRESHOLD', () => {
		it('is 0.7', () => {
			expect(MATURITY_THRESHOLD).toBe(0.7);
		});
	});

	describe('DOMAIN_WEIGHTS', () => {
		it('sums to 1.0', () => {
			const sum = Object.values(DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
			expect(sum).toBe(1.0);
		});

		it('has correct weights for each domain', () => {
			expect(DOMAIN_WEIGHTS.scope).toBe(0.3);
			expect(DOMAIN_WEIGHTS.timeline).toBe(0.2);
			expect(DOMAIN_WEIGHTS.budget).toBe(0.2);
			expect(DOMAIN_WEIGHTS.integrations).toBe(0.15);
			expect(DOMAIN_WEIGHTS.tech_stack).toBe(0.15);
		});
	});

	describe('VITAL_REQUIRED', () => {
		it('marks scope, timeline, budget, tech_stack as vital', () => {
			expect(VITAL_REQUIRED.scope).toBe(true);
			expect(VITAL_REQUIRED.timeline).toBe(true);
			expect(VITAL_REQUIRED.budget).toBe(true);
			expect(VITAL_REQUIRED.tech_stack).toBe(true);
		});

		it('marks integrations as not vital', () => {
			expect(VITAL_REQUIRED.integrations).toBe(false);
		});
	});
});
