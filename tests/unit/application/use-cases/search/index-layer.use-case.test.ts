import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexLayerUseCase } from '../../../../../src/application/use-cases/search/index-layer.use-case.js';
import type { MeiliSearchService } from '../../../../../src/infrastructure/external-apis/meilisearch.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';

describe('IndexLayerUseCase', () => {
  let useCase: IndexLayerUseCase;
  let meiliSearchService: MeiliSearchService;
  const now = new Date();

  beforeEach(() => {
    meiliSearchService = {
      addDocuments: vi.fn().mockResolvedValue(undefined),
      search: vi.fn(),
    } as any;
    useCase = new IndexLayerUseCase(meiliSearchService);
  });

  it('should index a layer document', async () => {
    const layer = new Layer({
      id: 'layer-1', name: 'Test Layer', slug: 'test-layer', description: 'A test',
      geometryType: GeometryType.POINT, sourceType: SourceType.WFS,
      sourceUrl: null, sourceLayer: null, tableName: 'test', schemaName: 'schema',
      minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true, opacity: 1, order: 0,
      metadata: null, subGroupId: 'sg-1', instanceId: 'inst-1', qgisProjectId: null,
      createdAt: now, updatedAt: now,
    });

    await useCase.execute(layer);

    expect(meiliSearchService.addDocuments).toHaveBeenCalledWith(
      'layers',
      [
        expect.objectContaining({
          id: 'layer-1',
          name: 'Test Layer',
          name_fr: 'Test Layer',
          name_en: 'Test Layer',
          slug: 'test-layer',
          instanceId: 'inst-1',
        }),
      ],
      'id',
    );
  });

  it('should localize a multilingual {fr,en} name/description into separate fields (regression: used to index raw JSON, breaking search relevance)', async () => {
    const layer = new Layer({
      id: 'layer-2',
      name: JSON.stringify({ fr: 'Hôpitaux', en: 'Hospitals' }),
      slug: 'hopitaux',
      description: JSON.stringify({ fr: 'Description FR', en: 'Description EN' }),
      geometryType: GeometryType.POINT, sourceType: SourceType.WFS,
      sourceUrl: null, sourceLayer: null, tableName: 'test', schemaName: 'schema',
      minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true, opacity: 1, order: 0,
      metadata: null, subGroupId: 'sg-1', instanceId: 'inst-1', qgisProjectId: null,
      createdAt: now, updatedAt: now,
    });

    await useCase.execute(layer);

    const [, documents] = vi.mocked(meiliSearchService.addDocuments).mock.calls[0];
    expect(documents[0]).toMatchObject({
      name: 'Hôpitaux',
      name_fr: 'Hôpitaux',
      name_en: 'Hospitals',
      description: 'Description FR',
      description_fr: 'Description FR',
      description_en: 'Description EN',
    });
    expect(documents[0].name).not.toContain('{');
  });
});
