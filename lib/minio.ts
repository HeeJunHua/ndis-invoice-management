/**
 * Shared MinIO client. Bucket auto-created on first use if missing.
 * TODO: confirm MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET
 * env vars are actually set in .env — this throws at import time if not.
 */
import { Client } from 'minio';

if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
  throw new Error('MinIO env vars are not set — check .env (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)');
}

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

export const BUCKET_NAME = process.env.MINIO_BUCKET ?? 'ndis-invoices';

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
  }
}