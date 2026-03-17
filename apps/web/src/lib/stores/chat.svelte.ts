import type { InterviewMessage } from '$lib/types/interview';
import type { DomainState } from '$lib/types/interview';
import { auth } from '$lib/firebase';
import { activeTone } from '$lib/stores/tone.svelte';

interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

interface ChatDocument {
	id: string;
	filename: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	mime_type: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
	try {
		const token = await auth.currentUser?.getIdToken(false);
		if (!token) return {};
		return { Authorization: `Bearer ${token}` };
	} catch {
		return {};
	}
}

function formatTime(date: Date | string | number): string {
	return new Date(date).toLocaleTimeString('pt-BR', {
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function createChatState(
	interviewId: string,
	initialMessages: InterviewMessage[],
	initialMaturity: number,
	initialDomains: Record<string, DomainState>,
	initialDocuments: ChatDocument[]
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
	let documents = $state<ChatDocument[]>(initialDocuments);

	let totalTokensUsed = $derived(
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
			const authHeaders = await getAuthHeaders();
			const response = await fetch(`/api/chat/${interviewId}/message`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders },
				body: JSON.stringify({ message: text, tone_instruction: activeTone.action }),
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

				buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
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
		const authHeaders = await getAuthHeaders();
		const formData = new FormData();
		formData.append('file', file);

		try {
			const response = await fetch(`/api/chat/${interviewId}/upload`, {
				method: 'POST',
				headers: { ...authHeaders },
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
				uploadError = `Erro no upload: ${errorData.error || 'Upload failed'}`;
				return false;
			}

			const data = await response.json();
			if (data.document) {
				documents = [...documents, {
					id: data.document.id,
					filename: data.document.filename,
					status: data.document.status,
					mime_type: file.type,
				}];
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
		get documents() {
			return documents;
		},
		get totalTokensUsed() {
			return totalTokensUsed;
		},
		sendMessage,
		uploadDocument,
	};
}
