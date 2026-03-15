import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
	stages: [
		{ duration: '30s', target: 5 }, // ramp up
		{ duration: '1m', target: 10 }, // sustained load
		{ duration: '30s', target: 0 }, // ramp down
	],
	thresholds: {
		http_req_duration: ['p(95)<2000'], // 95% under 2s
		http_req_failed: ['rate<0.1'], // <10% errors
		errors: ['rate<0.1'],
	},
};

const AI_URL = __ENV.AI_URL || 'http://localhost:8000';

export default function () {
	// Health check
	const healthRes = http.get(`${AI_URL}/health/services`);
	check(healthRes, {
		'health status 200': (r) => r.status === 200,
		'health has postgres': (r) => JSON.parse(r.body).postgres !== undefined,
	}) || errorRate.add(1);

	sleep(1);

	// Root endpoint
	const rootRes = http.get(`${AI_URL}/`);
	check(rootRes, {
		'root status 200': (r) => r.status === 200,
		'root is oute-ai': (r) => JSON.parse(r.body).service === 'oute-ai',
	}) || errorRate.add(1);

	sleep(0.5);
}
