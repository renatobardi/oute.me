export function fmtDate(iso: string | Date) {
	return new Date(iso).toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function maturityColor(m: number) {
	if (m >= 0.7) return 'var(--color-success, #10b981)';
	if (m >= 0.4) return 'var(--color-warning, #f59e0b)';
	return 'var(--color-error, #ef4444)';
}

export function statusBadgeClass(status: string) {
	switch (status) {
		case 'completed':
		case 'approved':
		case 'done':
			return 'badge-success';
		case 'estimating':
		case 'in_progress':
		case 'pending':
		case 'running':
			return 'badge-info';
		case 'pending_approval':
			return 'badge-warning';
		case 'failed':
			return 'badge-error';
		default:
			return 'badge-neutral';
	}
}

export function mimeLabel(mime: string) {
	const map: Record<string, string> = {
		'application/pdf': 'PDF',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
		'application/msword': 'Word',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
		'application/vnd.ms-excel': 'Excel',
		'text/csv': 'CSV',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
		'application/vnd.ms-powerpoint': 'PowerPoint',
		'image/png': 'PNG',
		'image/jpeg': 'JPEG',
		'image/webp': 'WebP',
		'image/gif': 'GIF',
	};
	return map[mime] ?? mime;
}
