import { describe, it, expect } from 'vitest';
import { Instance } from '../../../../src/domain/entities/instance.entity.js';

describe('Instance Entity', () => {
  const now = new Date();
  const props = {
    id: 'i1', name: 'Test Instance', slug: 'test-instance',
    description: 'Desc', logo: null, bbox: [-180, -90, 180, 90],
    centerLat: 0, centerLon: 0, defaultZoom: 5, isActive: true,
    createdAt: now, updatedAt: now,
  };

  it('should construct with all properties', () => {
    const instance = new Instance(props);
    expect(instance.id).toBe('i1');
    expect(instance.name).toBe('Test Instance');
    expect(instance.defaultZoom).toBe(5);
    expect(instance.isActive).toBe(true);
  });

  it('should handle nullable fields', () => {
    const instance = new Instance({ ...props, description: null, bbox: null, centerLat: null, centerLon: null });
    expect(instance.description).toBeNull();
    expect(instance.bbox).toBeNull();
  });
});
