/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-09-29
 * Scope: Implemented the S3-client photo storage adapter from the Phase 2 plan (Task 2).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PhotoFile, PhotoStorage } from './photoStorage.js';

export interface S3PhotoStorageOptions {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export function createS3PhotoStorage(
  options: S3PhotoStorageOptions,
  client: S3Client = new S3Client({
    endpoint: options.endpoint,
    region: 'us-east-1', // required by the SDK; ignored by MinIO
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
  }),
): PhotoStorage {
  const base = `${options.endpoint.replace(/\/+$/, '')}/${options.bucket}/`;

  function keyOf(location: string): string {
    if (!location.startsWith(base)) {
      throw new Error(`Not a photo in this bucket: ${location}`);
    }
    return location.slice(base.length);
  }

  async function put(key: string, file: PhotoFile): Promise<string> {
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
      }),
    );
    return `${base}${key}`;
  }

  return {
    upload: (file) => put(randomUUID(), file),
    update: (location, file) => put(keyOf(location), file),
    async delete(location) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: keyOf(location) }));
    },
    async view(location) {
      return location;
    },
  };
}

export function createConfiguredPhotoStorage(settings: {
  endpoint?: string | undefined;
  bucket?: string | undefined;
  accessKey?: string | undefined;
  secretKey?: string | undefined;
}): PhotoStorage {
  const { endpoint, bucket, accessKey, secretKey } = settings;
  if (endpoint && bucket && accessKey && secretKey) {
    return createS3PhotoStorage({ endpoint, bucket, accessKey, secretKey });
  }
  const unavailable = async (): Promise<never> => {
    throw new Error('Photo storage is not configured (set the PHOTO_STORE_* variables).');
  };
  return { upload: unavailable, update: unavailable, delete: unavailable, view: unavailable };
}
