import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		setupFiles: ['src/tests/setup.ts'],
		testTimeout: 10000,
		globals: true,
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			'$env/dynamic/private': path.resolve(__dirname, './src/tests/mock-env.ts'),
		},
	},
});
