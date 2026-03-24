export const env: Record<string, string> = {
	DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
	AI_SERVICE_URL: 'http://localhost:8000',
	FIREBASE_PROJECT_ID: 'test-project',
	FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
	FIREBASE_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
	ENVIRONMENT: 'test',
	ADMIN_EMAILS: 'admin@test.com',
};
