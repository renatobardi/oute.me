import pino from 'pino';

export const logger = pino({
	level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
	// Cloud Logging expects "severity" instead of "level"
	formatters: {
		level(label: string) {
			const severityMap: Record<string, string> = {
				trace: 'DEBUG',
				debug: 'DEBUG',
				info: 'INFO',
				warn: 'WARNING',
				error: 'ERROR',
				fatal: 'CRITICAL',
			};
			return { severity: severityMap[label] ?? 'DEFAULT' };
		},
	},
	// Cloud Logging expects "message" instead of "msg"
	messageKey: 'message',
});
