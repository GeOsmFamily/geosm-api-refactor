import { describe, it, expect, afterAll, beforeAll } from 'vitest';

// ─── MinIO / Storage Service ────────────────────────────────────────────────

const minioAvailable =
  !!process.env.MINIO_ENDPOINT &&
  !!process.env.MINIO_ACCESS_KEY &&
  !!process.env.MINIO_SECRET_KEY;

describe.skipIf(!minioAvailable)('MinIO Storage Service', () => {
  let service: any; // MinioStorageService

  beforeAll(async () => {
    // Patch config before importing the service
    const { config } = await import('../../src/config/env.config.js');
    Object.assign(config, {
      MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
      MINIO_PORT: Number(process.env.MINIO_PORT ?? 9000),
      MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
      MINIO_BUCKET: process.env.MINIO_BUCKET ?? 'geosm-test',
      MINIO_USE_SSL: false,
    });
    const { MinioStorageService } = await import(
      '../../src/infrastructure/storage/minio.service.js'
    );
    service = new MinioStorageService();
    await service.ensureBucket();
  });

  const testKey = `integration-test-${Date.now()}.txt`;
  const testContent = Buffer.from('hello integration tests');

  it('should upload a file', async () => {
    const key = await service.uploadFile(testKey, testContent, 'text/plain');
    expect(key).toBe(testKey);
  });

  it('should confirm the file exists', async () => {
    const exists = await service.fileExists(testKey);
    expect(exists).toBe(true);
  });

  it('should get file info', async () => {
    const info = await service.getFileInfo(testKey);
    expect(info.size).toBe(testContent.length);
    expect(info.lastModified).toBeInstanceOf(Date);
  });

  it('should download the file', async () => {
    const stream = await service.downloadFile(testKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe(testContent.toString());
  });

  it('should generate a presigned URL', async () => {
    const url = await service.getPresignedUrl(testKey, 60);
    expect(url).toContain(testKey);
  });

  it('should delete the file', async () => {
    await service.deleteFile(testKey);
    const exists = await service.fileExists(testKey);
    expect(exists).toBe(false);
  });
});

// ─── MeiliSearch Service ────────────────────────────────────────────────────

const meiliAvailable =
  !!process.env.MEILISEARCH_HOST && !!process.env.MEILISEARCH_API_KEY;

describe.skipIf(!meiliAvailable)('MeiliSearch Service', () => {
  let service: any; // MeiliSearchService
  const testIndex = `test-index-${Date.now()}`;

  beforeAll(async () => {
    const { config } = await import('../../src/config/env.config.js');
    Object.assign(config, {
      MEILISEARCH_HOST: process.env.MEILISEARCH_HOST,
      MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
    });
    const { MeiliSearchService } = await import(
      '../../src/infrastructure/external-apis/meilisearch.service.js'
    );
    service = new MeiliSearchService();
  });

  afterAll(async () => {
    // Clean up the test index
    try {
      const host = process.env.MEILISEARCH_HOST;
      const key = process.env.MEILISEARCH_API_KEY;
      await fetch(`${host}/indexes/${testIndex}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
      });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should add documents', async () => {
    await expect(
      service.addDocuments(testIndex, [
        { id: '1', name: 'Yaoundé', type: 'city' },
        { id: '2', name: 'Douala', type: 'city' },
        { id: '3', name: 'Bamenda', type: 'city' },
      ]),
    ).resolves.not.toThrow();
  });

  it('should search documents', async () => {
    // MeiliSearch indexes asynchronously; wait briefly
    await new Promise((r) => setTimeout(r, 1500));
    const result = await service.search(testIndex, 'Yaoundé');
    expect(result.hits).toBeDefined();
    expect(result.query).toBe('Yaoundé');
  });

  it('should delete documents', async () => {
    await expect(
      service.deleteDocuments(testIndex, ['1']),
    ).resolves.not.toThrow();
  });
});

// ─── Redis Service ──────────────────────────────────────────────────────────

const redisAvailable = !!process.env.REDIS_HOST;

describe.skipIf(!redisAvailable)('Redis Service', () => {
  let service: any; // RedisService

  beforeAll(async () => {
    const { RedisService } = await import(
      '../../src/infrastructure/cache/redis.service.js'
    );
    service = new RedisService();
  });

  afterAll(async () => {
    if (service) {
      // clean up test keys
      try {
        await service.del('integration-test-key');
      } catch {
        // ignore
      }
      await service.disconnect();
    }
  });

  it('should set a value', async () => {
    await expect(
      service.set('integration-test-key', 'test-value', 60),
    ).resolves.not.toThrow();
  });

  it('should get the value back', async () => {
    const value = await service.get('integration-test-key');
    expect(value).toBe('test-value');
  });

  it('should return null for missing key', async () => {
    const value = await service.get('nonexistent-key-' + Date.now());
    expect(value).toBeNull();
  });

  it('should delete a key', async () => {
    await service.del('integration-test-key');
    const value = await service.get('integration-test-key');
    expect(value).toBeNull();
  });
});
