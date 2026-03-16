import type { InterviewMessage } from '$lib/types/interview';
import type { DomainState } from '$lib/types/interview';

interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

function formatTime(date: Date | string): string {
	return new Date(date).toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function createChatState(
	interviewId: string,
	initialMessages: InterviewMessage[],
	initialMaturity: number,
	initialDomains: Record<string, DomainState>
) {
	let messages = $state<ChatMessage[]>(
		initialMessages.map((m) => ({
			id: m.id,
			role: m.role as 'user' | 'assistant',
			content: m.content,
			timestamp: formatTime(m.created_at),
		}))
	);
	let isStreaming = $state(false);
	let maturity = $state(initialMaturity);
	let domains = $state(initialDomains);
	let currentStreamText = $state('');
	let error = $state<string | null>(null);
	let uploadError = $state<string | null>(null);

	const totalTokensUsed = $derived(
		messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
	);

	async function sendMessage(text: string) {
		if (isStreaming || !text.trim()) return;

		error = null;
		isStreaming = true;
		currentStreamText = '';

		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			timestamp: formatTime(Date.now()),
		};
		messages = [...messages, userMsg];

		try {
			const response = await fetch(`/api/chat/${interviewId}/message`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text }),
			});

			if (!response.ok) {
				throw new Error(`Erro: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response stream');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split('\n\n');
				buffer = events.pop() || '';

				for (const eventStr of events) {
					if (!eventStr.trim()) continue;

					const eventMatch = eventStr.match(/^event:\s*(.+)$/m);
					const dataMatch = eventStr.match(/^data:\s*(.+)$/m);
					if (!eventMatch || !dataMatch) continue;

					const eventType = eventMatch[1];
					try {
						const data = JSON.parse(dataMatch[1]);

						if (eventType === 'message_chunk') {
							currentStreamText += data.text;
						} else if (eventType === 'state_update') {
							maturity = data.maturity;
							domains = data.domains;
						} else if (eventType === 'done') {
							messages = [
								...messages,
								{
									id: data.message_id,
									role: 'assistant',
									content: currentStreamText,
									timestamp: formatTime(Date.now()),
								},
							];
							currentStreamText = '';
						}
					} catch {
						// skip malformed events
					}
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erro ao enviar mensagem';
		} finally {
			isStreaming = false;
		}
	}

	async function uploadDocument(file: File): Promise<boolean> {
		uploadError = null;
		const formData = new FormData();
		formData.append('file', file);

		try {
			const response = await fetch(`/api/chat/${interviewId}/upload`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Upload failed');
				uploadError = `Erro no upload: ${errorText}`;
				return false;
			}

			return true;
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Erro ao enviar documento';
			return false;
		}
	}

	return {
		get messages() {
			return messages;
		},
		get isStreaming() {
			return isStreaming;
		},
		get maturity() {
			return maturity;
		},
		get domains() {
			return domains;
		},
		get currentStreamText() {
			return currentStreamText;
		},
		get error() {
			return error;
		},
		set error(value: string | null) {
			error = value;
		},
		get uploadError() {
			return uploadError;
		},
		set uploadError(value: string | null) {
			uploadError = value;
		},
		get totalTokensUsed() {
			return totalTokensUsed;
		},
		sendMessage,
		uploadDocument,
	};
}
