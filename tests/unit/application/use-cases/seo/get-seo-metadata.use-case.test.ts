import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSeoMetadataUseCase } from '../../../../../src/application/use-cases/seo/get-seo-metadata.use-case.js';

describe('GetSeoMetadataUseCase', () => {
  let useCase: GetSeoMetadataUseCase;
  let prisma: { instance: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = { instance: { findUnique: vi.fn() } };
    useCase = new GetSeoMetadataUseCase(prisma as any);
  });

  it('should return SEO metadata for a valid instance', async () => {
    prisma.instance.findUnique.mockResolvedValue({
      name: 'My Instance',
      slug: 'my-instance',
      description: 'A great instance',
      logo: 'https://example.com/logo.png',
      groups: [{ name: 'Rivers' }, { name: 'Roads' }],
    });

    const result = await useCase.execute('my-instance', 'https://geosm.com');

    expect(result).toEqual({
      title: 'My Instance - GeoSM',
      description: 'A great instance',
      ogImage: 'https://example.com/logo.png',
      ogUrl: 'https://geosm.com/my-instance',
      siteName: 'GeoSM',
      keywords: ['Rivers', 'Roads'],
    });
  });

  it('should return null if instance not found', async () => {
    prisma.instance.findUnique.mockResolvedValue(null);
    const result = await useCase.execute('missing', 'https://geosm.com');
    expect(result).toBeNull();
  });

  it('should use default description when instance has none', async () => {
    prisma.instance.findUnique.mockResolvedValue({
      name: 'Test',
      slug: 'test',
      description: null,
      logo: null,
      groups: [],
    });

    const result = await useCase.execute('test', 'https://geosm.com');
    expect(result!.description).toBe('Explore Test geospatial data on GeoSM');
  });
});
