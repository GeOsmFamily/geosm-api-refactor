import { describe, it, expect } from 'vitest';
import { Layer } from '../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../src/domain/enums.js';

describe('Layer Entity', () => {
  const now = new Date();
  const props = {
    id: 'l1', name: 'Test Layer', slug: 'test-layer', description: 'A layer',
    geometryType: GeometryType.POLYGON, sourceType: SourceType.WMS,
    sourceUrl: 'http://example.com', sourceLayer: null, tableName: 'test',
    schemaName: 'public', minZoom: 0, maxZoom: 18, isVisible: true,
    isQueryable: true, opacity: 1, order: 0, metadata: null,
    subGroupId: 'sg1', instanceId: 'i1', qgisProjectId: null,
    createdAt: now, updatedAt: now,
  };

  it('should construct with all properties', () => {
    const layer = new Layer(props);
    expect(layer.id).toBe('l1');
    expect(layer.name).toBe('Test Layer');
    expect(layer.geometryType).toBe(GeometryType.POLYGON);
    expect(layer.sourceType).toBe(SourceType.WMS);
    expect(layer.isVisible).toBe(true);
  });

  it('should handle nullable fields', () => {
    const layer = new Layer({ ...props, description: null, sourceUrl: null });
    expect(layer.description).toBeNull();
    expect(layer.sourceUrl).toBeNull();
  });
});
