/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-11-06
 * Scope: ECS Fargate migration - checks PHOTO_STORE_REGION reaches the S3 client, per George's ECS
 *        Fargate plan, Phase 1 item 6. No requirements, architecture, schema, or API decisions were made
 *        by the AI tool.
 * Author review:
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('@aws-sdk/client-s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aws-sdk/client-s3')>()),
  S3Client: class {
    constructor(options: Record<string, unknown>) {
      constructed.push(options);
    }
  },
}));

const { createConfiguredPhotoStorage } = await import('../../src/storage/s3PhotoStorage.js');

const settings = {
  endpoint: 'https://s3.ap-southeast-1.amazonaws.com',
  bucket: 'photos',
  accessKey: 'key',
  secretKey: 'secret',
};

describe('photo store region', () => {
  beforeEach(() => {
    constructed.length = 0;
  });

  it('falls back to us-east-1, which MinIO ignores', () => {
    createConfiguredPhotoStorage(settings);
    expect(constructed[0]).toMatchObject({ region: 'us-east-1', forcePathStyle: true });
  });

  it('uses the configured region and keeps path-style addressing', () => {
    createConfiguredPhotoStorage({ ...settings, region: 'ap-southeast-1' });
    expect(constructed[0]).toMatchObject({ region: 'ap-southeast-1', forcePathStyle: true });
  });
});
