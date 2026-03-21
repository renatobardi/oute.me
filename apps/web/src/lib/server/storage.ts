/**
 * storage.ts
 * ==========
 * Armazenamento de arquivos via Google Cloud Storage (GCS).
 * Autenticação via ADC — sem API key, usa o Service Account do Cloud Run.
 *
 * Bucket por ambiente:
 *   production  → oute-prod-uploads  (ENVIRONMENT=production)
 *   development → oute-dev-uploads   (ENVIRONMENT=development ou ausente)
 *
 * Para sobrescrever o bucket: GOOGLE_CLOUD_STORAGE_BUCKET=nome-do-bucket
 *
 * Desenvolvimento local: rodar `gcloud auth application-default login` uma vez.
 */

import { env } from '$env/dynamic/private';

function getBucket(): string {
	if (env.GOOGLE_CLOUD_STORAGE_BUCKET) return env.GOOGLE_CLOUD_STORAGE_BUCKET;
	return env.ENVIRONMENT === 'production' ? 'oute-prod-uploads' : 'oute-dev-uploads';
}

export function storageBackend(): string {
	return `gcs:${getBucket()}`;
}

export async function uploadFile(
	storagePath: string,
	buffer: Buffer,
	mimeType: string
): Promise<void> {
	const { Storage } = await import('@google-cloud/storage');
	const file = new Storage().bucket(getBucket()).file(storagePath);
	await file.save(buffer, { metadata: { contentType: mimeType }, resumable: false });
}

export async function downloadFile(storagePath: string): Promise<Buffer> {
	const { Storage } = await import('@google-cloud/storage');
	const [contents] = await new Storage().bucket(getBucket()).file(storagePath).download();
	return contents;
}

export async function deleteFile(storagePath: string): Promise<void> {
	const { Storage } = await import('@google-cloud/storage');
	await new Storage().bucket(getBucket()).file(storagePath).delete({ ignoreNotFound: true });
}
