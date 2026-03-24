/**
 * Mock environment variables for testing
 * Maps to $env/dynamic/private
 */
export const env = {
	DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost/test_db',
	FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'test-project',
	FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || 'test@test-project.iam.gserviceaccount.com',
	FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || 'test-private-key',
	AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
};
