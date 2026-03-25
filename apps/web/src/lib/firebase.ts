import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
	getRemoteConfig,
	fetchAndActivate,
	getValue,
	type RemoteConfig,
} from 'firebase/remote-config';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_APP_ID,
} from '$env/static/public';

function getFirebaseClient(): FirebaseApp {
	const existing = getApps();
	if (existing.length > 0) {
		return existing[0];
	}

	return initializeApp({
		apiKey: PUBLIC_FIREBASE_API_KEY,
		authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
		projectId: PUBLIC_FIREBASE_PROJECT_ID,
		appId: PUBLIC_FIREBASE_APP_ID,
	});
}

const app = getFirebaseClient();
export const auth: Auth = getAuth(app);

// ── Remote Config ─────────────────────────────────────────────────────────────

let _remoteConfig: RemoteConfig | null = null;

export const REMOTE_CONFIG_DEFAULTS = {
	maturity_threshold: 0.7,
	estimation_timeout_seconds: 150,
	max_interview_messages: 100,
	enable_document_types: 'pdf,docx,xlsx,pptx,csv,png,jpg',
	maintenance_mode: false,
	llm_model: 'gemini-2.5-flash',
} as const;

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG_DEFAULTS;

function getRemoteConfigInstance(): RemoteConfig | null {
	if (typeof window === 'undefined') return null;
	if (_remoteConfig) return _remoteConfig;

	const rc = getRemoteConfig(app);
	rc.settings.minimumFetchIntervalMillis = 3_600_000; // 1h em prod
	rc.defaultConfig = { ...REMOTE_CONFIG_DEFAULTS };
	_remoteConfig = rc;
	return rc;
}

export async function initRemoteConfig(): Promise<void> {
	const rc = getRemoteConfigInstance();
	if (!rc) return;
	try {
		await fetchAndActivate(rc);
	} catch {
		// Falha silenciosa — defaults locais continuam válidos
	}
}

export function getConfigValue(key: 'maturity_threshold' | 'estimation_timeout_seconds' | 'max_interview_messages'): number;
export function getConfigValue(key: 'maintenance_mode'): boolean;
export function getConfigValue(key: 'enable_document_types' | 'llm_model'): string;
export function getConfigValue(key: RemoteConfigKey): number | boolean | string {
	const rc = getRemoteConfigInstance();
	const defaultVal = REMOTE_CONFIG_DEFAULTS[key];

	if (!rc) return defaultVal;

	const raw = getValue(rc, key);
	if (typeof defaultVal === 'number') return raw.asNumber();
	if (typeof defaultVal === 'boolean') return raw.asBoolean();
	return raw.asString();
}
