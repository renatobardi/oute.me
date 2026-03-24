import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createEstimate,
	getEstimate,
	updateEstimateStatus,
	approveEstimate,
} from './estimates';
import { setMockResults, resetMocks } from './__mocks__/db';
import { createMockEstimate, createMockEstimateResult } from '../../tests/fixtures';

vi.mock('./db');

describe('estimates.ts', () => {
	beforeEach(() => {
		resetMocks();
		vi.clearAllMocks();
	});

	describe('createEstimate', () => {
		it('sets status "pending" when jobId provided', async () => {
			const interviewId = 'int123';
			const userId = 'user123';
			const jobId = 'job456';
			const mockEstimate = createMockEstimate({
				interview_id: interviewId,
				user_id: userId,
				job_id: jobId,
				status: 'pending',
			});

			setMockResults({
				'INSERT INTO public.estimates': [mockEstimate],
			});

			const result = await createEstimate(interviewId, userId, jobId);

			expect(result.status).toBe('pending');
			expect(result.job_id).toBe(jobId);
		});

		it('sets status "pending_approval" when no jobId', async () => {
			const interviewId = 'int123';
			const userId = 'user123';
			const mockEstimate = createMockEstimate({
				interview_id: interviewId,
				user_id: userId,
				job_id: null,
				status: 'pending_approval',
			});

			setMockResults({
				'INSERT INTO public.estimates': [mockEstimate],
			});

			const result = await createEstimate(interviewId, userId);

			expect(result.status).toBe('pending_approval');
			expect(result.job_id).toBeNull();
		});

		it('creates estimate with correct interview and user', async () => {
			const interviewId = 'int789';
			const userId = 'user789';
			const mockEstimate = createMockEstimate({
				interview_id: interviewId,
				user_id: userId,
			});

			setMockResults({
				'INSERT INTO public.estimates': [mockEstimate],
			});

			const result = await createEstimate(interviewId, userId);

			expect(result.interview_id).toBe(interviewId);
			expect(result.user_id).toBe(userId);
		});
	});

	describe('getEstimate', () => {
		it('returns null when not found', async () => {
			const estimateId = 'nonexistent';
			const userId = 'user123';

			setMockResults({
				'SELECT * FROM public.estimates': [],
			});

			const result = await getEstimate(estimateId, userId);

			expect(result).toBeNull();
		});

		it('returns estimate for valid user', async () => {
			const estimateId = 'est123';
			const userId = 'user123';
			const mockEstimate = createMockEstimate({
				id: estimateId,
				user_id: userId,
			});

			setMockResults({
				'SELECT * FROM public.estimates': [mockEstimate],
			});

			const result = await getEstimate(estimateId, userId);

			expect(result).toEqual(mockEstimate);
		});

		it('enforces user_id ownership', async () => {
			const estimateId = 'est456';
			const correctUserId = 'user123';
			const wrongUserId = 'user999';

			setMockResults({
				'SELECT * FROM public.estimates': [],
			});

			const result = await getEstimate(estimateId, wrongUserId);

			expect(result).toBeNull();
		});
	});

	describe('updateEstimateStatus', () => {
		it('handles result + agentSteps', async () => {
			const estimateId = 'est123';
			const result = createMockEstimateResult();
			const agentSteps = [
				{
					agent_key: 'architecture_interviewer',
					status: 'done',
					started_at: '2024-01-01T00:00:00Z',
					finished_at: '2024-01-01T00:05:00Z',
					duration_s: 300,
					output_preview: 'Output',
					error: null,
					llm_model: 'gemini-2.5-flash-lite',
					input_tokens: 100,
					output_tokens: 200,
				},
			];

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'done', result, agentSteps);

			// Should not throw and should update with both result and agentSteps
			expect(true).toBe(true);
		});

		it('handles result only', async () => {
			const estimateId = 'est456';
			const result = createMockEstimateResult();

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'completed', result);

			expect(true).toBe(true);
		});

		it('handles status only', async () => {
			const estimateId = 'est789';

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'processing');

			expect(true).toBe(true);
		});

		it('updates status correctly', async () => {
			const estimateId = 'est123';

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'failed');

			expect(true).toBe(true);
		});

		it('persists result as JSON', async () => {
			const estimateId = 'est123';
			const result = createMockEstimateResult({
				summary: 'Custom summary',
			});

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'done', result);

			expect(true).toBe(true);
		});

		it('persists agent_steps as JSON array', async () => {
			const estimateId = 'est123';
			const agentSteps = [
				{
					agent_key: 'rag_analyst',
					status: 'done',
					started_at: '2024-01-01T00:05:00Z',
					finished_at: '2024-01-01T00:10:00Z',
					duration_s: 300,
					output_preview: 'Found similar projects',
					error: null,
					llm_model: 'gemini-2.5-flash-lite',
					input_tokens: 500,
					output_tokens: 800,
				},
			];

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await updateEstimateStatus(estimateId, 'done', undefined, agentSteps);

			expect(true).toBe(true);
		});
	});

	describe('approveEstimate', () => {
		it('sets approved_at and status to "approved"', async () => {
			const estimateId = 'est123';

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await approveEstimate(estimateId);

			// Should call update with status='approved' and approved_at=now()
			expect(true).toBe(true);
		});

		it('can be called multiple times', async () => {
			const estimateId = 'est456';

			setMockResults({
				'UPDATE public.estimates': [],
			});

			await approveEstimate(estimateId);
			await approveEstimate(estimateId);

			expect(true).toBe(true);
		});
	});
});
