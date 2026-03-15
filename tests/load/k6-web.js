import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
	stages: [
		{ duration: '30s', target: 10 }, // ramp up
		{ duration: '1m', target: 20 }, // sustained load
		{ duration: '30s', target: 50 }, // peak
		{ duration: '30s', target: 0 }, // ramp down
	],
	thresholds: {
		http_req_duration: ['p(95)<1000'], // 95% under 1s
		http_req_failed: ['rate<0.05'], // <5% errors
		errors: ['rate<0.05'],
	},
};

const BASE_URL = __ENV.BASE_URL || 'https://oute.me';

export default function () {
	// Home page
	const homeRes = http.get(`${BASE_URL}/`);
	check(homeRes, {
		'home status 200': (r) => r.status === 200,
		'home duration < 500ms': (r) => r.timings.duration < 500,
	}) || errorRate.add(1);

	sleep(1);

	// API health (via BFF)
	const healthRes = http.get(`${BASE_URL}/api/interviews`, {
		headers: { Authorization: 'Bearer test-invalid-token' },
	});
	check(healthRes, {
		'unauth returns 401': (r) => r.status === 401,
	});

	sleep(0.5);
}
