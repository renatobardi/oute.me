import { beforeAll } from 'vitest';

// Set up environment variables for testing
beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_db';
	process.env.FIREBASE_PROJECT_ID = 'test-project';
	process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
	process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
	process.env.AI_SERVICE_URL = 'http://localhost:8000';
});
