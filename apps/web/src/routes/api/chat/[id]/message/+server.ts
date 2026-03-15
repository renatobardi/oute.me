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

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const interview = await getInterview(params.id, user.id);
	if (!interview) {
		throw error(404, 'Interview not found');
	}

	if (interview.status !== 'active') {
		throw error(400, 'Interview is not active');
	}

	const body = await request.json();
	const userMessage = body.message as string;
	if (!userMessage?.trim()) {
		throw error(400, 'Message is required');
	}

	await addMessage(params.id, 'user', userMessage);

	const recentMessages = await getRecentMessages(params.id);
	const documents = await getDocuments(params.id);

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

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
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
								updateInterviewState(params.id, state, maturity).catch(() => {});
							}

							if (eventType === 'done' && data.full_response) {
								fullResponse = data.full_response as string;
								const tokensUsed = (data.tokens_used as number) || 0;
								addMessage(params.id, 'assistant', fullResponse, tokensUsed).catch(
									() => {}
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
