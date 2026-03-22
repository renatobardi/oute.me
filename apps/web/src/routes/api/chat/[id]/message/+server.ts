import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import {
	getInterview,
	getRecentMessages,
	addMessage,
	updateInterviewTitle,
	getDocuments,
	persistChatTurn,
} from '$lib/server/interviews';
import { proxySSE } from '$lib/server/ai-client';
import { logBusinessEvent } from '$lib/server/audit';
import { logger } from '$lib/server/logger';
import { checkRateLimit } from '$lib/server/rate-limit';
import type { InterviewState } from '$lib/types/interview';

const SSE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function sseErrorEvent(message: string): Uint8Array {
	const event = `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`;
	return new TextEncoder().encode(event);
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	requireAuth(locals);
	const user = locals.dbUser!;

	const allowed = await checkRateLimit(`chat:${user.id}`);
	if (!allowed) {
		return new Response(
			JSON.stringify({ error: 'Aguarde antes de enviar outra mensagem' }),
			{ status: 429, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const interview = await getInterview(params.id, user.id);
	if (!interview) {
		throw error(404, 'Interview not found');
	}

	if (interview.status !== 'active') {
		throw error(400, 'Interview is not active');
	}

	const body = await request.json();
	const userMessage = body.message as string;
	const toneInstruction = (body.tone_instruction as string) || null;
	const llmModel = (body.llm_model as string) || 'gemini-2.5-flash';
	if (!userMessage?.trim()) {
		throw error(400, 'Message is required');
	}

	await addMessage(params.id, 'user', userMessage);

	const [recentMessages, documents] = await Promise.all([
		getRecentMessages(params.id),
		getDocuments(params.id),
	]);

	const documentsContext = documents
		.filter((d) => d.extracted_text && d.status === 'completed')
		.map((d) => `[${d.filename}]: ${d.extracted_text}`)
		.join('\n\n');

	const isResumption = recentMessages.length > 1;

	const chatRequest = {
		interview_id: params.id,
		state: interview.state,
		history: recentMessages.map((m) => ({ role: m.role, content: m.content })),
		user_message: userMessage,
		documents_context: documentsContext || null,
		tone_instruction: toneInstruction,
		is_resumption: isResumption,
		llm_model: llmModel,
		current_title: interview.title ?? null,
		user_name: user.display_name || user.full_name || null,
	};

	const aiResponse = await proxySSE('/chat/message', chatRequest);

	if (!aiResponse.body) {
		throw error(502, 'No response from AI service');
	}

	const reader = aiResponse.body.getReader();
	const decoder = new TextDecoder();

	const stream = new ReadableStream({
		async start(controller) {
			let buffer = '';
			let fullResponse = '';
			let tokensUsed = 0;
			let lastState: InterviewState | null = null;
			let lastMaturity = 0;
			const oldMaturity = interview.maturity;
			let maturityThresholdCrossed = false;
			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			try {
				timeoutId = setTimeout(() => {
					logger.error({ interviewId: params.id }, 'SSE stream timeout');
					controller.enqueue(sseErrorEvent('Stream timeout'));
					reader.cancel();
					controller.close();
				}, SSE_TIMEOUT_MS);

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
					const events = buffer.split('\n\n');
					buffer = events.pop() || '';

					for (const eventStr of events) {
						if (!eventStr.trim()) continue;

						controller.enqueue(new TextEncoder().encode(eventStr + '\n\n'));

						const dataMatch = eventStr.match(/^data:\s*(.+)$/m);
						const eventMatch = eventStr.match(/^event:\s*(.+)$/m);

						if (!dataMatch || !eventMatch) continue;

						try {
							const eventType = eventMatch[1];
							const data = JSON.parse(dataMatch[1]);

							if (eventType === 'state_update' && data.state) {
								lastState = data.state as InterviewState;
								lastMaturity = data.maturity as number;
								if (lastMaturity >= 0.70 && oldMaturity < 0.70) {
									maturityThresholdCrossed = true;
								}

								// Apply AI-suggested title only if interview has no title yet
								const suggestedTitle = data.suggested_title as string | undefined;
								if (suggestedTitle && !interview.title) {
									updateInterviewTitle(params.id, suggestedTitle).catch((err) => {
										logger.warn({ err, interviewId: params.id }, 'Failed to update interview title');
									});
									const titleEvent = `event: title_update\ndata: ${JSON.stringify({ title: suggestedTitle })}\n\n`;
									controller.enqueue(new TextEncoder().encode(titleEvent));
								}
							}

							if (eventType === 'done' && data.full_response) {
								fullResponse = data.full_response as string;
								tokensUsed = (data.tokens_used as number) || 0;
							}
						} catch {
							// parsing error, continue streaming
						}
					}
				}

				if (buffer.trim()) {
					controller.enqueue(new TextEncoder().encode(buffer + '\n\n'));
				}

				if (fullResponse) {
					try {
						await persistChatTurn(params.id, fullResponse, tokensUsed, lastState, lastMaturity);
					} catch (err) {
						logger.error({ err, interviewId: params.id }, 'Persistence transaction failed');
						controller.enqueue(
							new TextEncoder().encode(
								`event: error\ndata: ${JSON.stringify({
									type: 'persistence_warning',
									message: 'Algumas alterações podem não ter sido salvas. Tente novamente.',
									details: [(err as Error)?.message ?? 'Unknown error'],
								})}\n\n`
							)
						);
					}
				}

				if (maturityThresholdCrossed) {
					void logBusinessEvent(
						'interview.maturity_reached',
						user.id,
						'interview',
						params.id,
						{ maturity: lastMaturity }
					);
				}
			} finally {
				if (timeoutId) clearTimeout(timeoutId);
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no',
		},
	});
};
