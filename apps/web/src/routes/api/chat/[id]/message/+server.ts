import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import {
	getInterview,
	getRecentMessages,
	addMessage,
	updateInterviewState,
	getDocuments,
} from '$lib/server/interviews';
import { proxySSE } from '$lib/server/ai-client';
import type { InterviewState } from '$lib/types/interview';

const SSE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const rateLimitMap = new Map<string, number>();

function checkRateLimit(userId: string): boolean {
	const now = Date.now();
	const lastTime = rateLimitMap.get(userId);
	if (lastTime && now - lastTime < 2000) {
		return false;
	}
	rateLimitMap.set(userId, now);
	return true;
}

function sseErrorEvent(message: string): Uint8Array {
	const event = `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`;
	return new TextEncoder().encode(event);
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	if (!checkRateLimit(user.id)) {
		throw error(429, 'Too many messages. Please wait before sending another.');
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

	const chatRequest = {
		interview_id: params.id,
		state: interview.state,
		history: recentMessages.map((m) => ({ role: m.role, content: m.content })),
		user_message: userMessage,
		documents_context: documentsContext || null,
		tone_instruction: toneInstruction,
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
			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			try {
				timeoutId = setTimeout(() => {
					console.error(`[SSE] Stream timeout after ${SSE_TIMEOUT_MS}ms for interview ${params.id}`);
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
								const state = data.state as InterviewState;
								const maturity = data.maturity as number;
								updateInterviewState(params.id, state, maturity).catch((err) => {
									console.error(`[SSE] Failed to update interview state for ${params.id}:`, err);
									controller.enqueue(sseErrorEvent('Failed to persist state update'));
								});
							}

							if (eventType === 'done' && data.full_response) {
								fullResponse = data.full_response as string;
								const tokensUsed = (data.tokens_used as number) || 0;
								addMessage(params.id, 'assistant', fullResponse, tokensUsed).catch(
									(err) => {
										console.error(`[SSE] Failed to save assistant message for ${params.id}:`, err);
										controller.enqueue(sseErrorEvent('Failed to persist assistant message'));
									}
								);
							}
						} catch {
							// parsing error, continue streaming
						}
					}
				}

				if (buffer.trim()) {
					controller.enqueue(new TextEncoder().encode(buffer + '\n\n'));
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
			Connection: 'keep-alive',
		},
	});
};
