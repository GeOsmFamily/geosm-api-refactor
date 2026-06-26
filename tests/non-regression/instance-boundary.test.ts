import { describe, it, expect } from 'vitest';
import { Instance, type InstanceProps } from '../../src/domain/entities/instance.entity.js';

function makeProps(overrides: Partial<InstanceProps> = {}): InstanceProps {
  return {
    id: 'inst-1',
    name: 'Test Instance',
    slug: 'test-instance',
    description: null,
    logo: null,
    bbox: null,
    centerLat: null,
    centerLon: null,
    defaultZoom: 10,
    boundaryTable: null,
    boundaryId: null,
    boundaryGeomCol: null,
    adminLevel: null,
    parentInstanceId: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('Instance boundary non-regression', () => {
  it('hasBoundary() returns false when boundaryTable is null', () => {
    const instance = new Instance(makeProps());
    expect(instance.hasBoundary()).toBe(false);
  });

  it('hasBoundary() returns false when boundaryId is null', () => {
    const instance = new Instance(makeProps({ boundaryTable: 'boundaries' }));
    expect(instance.hasBoundary()).toBe(false);
  });

  it('hasBoundary() returns true when both boundaryTable and boundaryId are set', () => {
    const instance = new Instance(makeProps({ boundaryTable: 'boundaries', boundaryId: 42 }));
    expect(instance.hasBoundary()).toBe(true);
  });

  it('hasBoundary() returns true even with boundaryId = 0', () => {
    const instance = new Instance(makeProps({ boundaryTable: 'boundaries', boundaryId: 0 }));
    // boundaryId 0 is not null, so hasBoundary should return true
    expect(instance.hasBoundary()).toBe(true);
  });

  it('stores all boundary fields correctly', () => {
    const instance = new Instance(makeProps({
      boundaryTable: 'admin_boundaries',
      boundaryId: 5,
      boundaryGeomCol: 'the_geom',
    }));
    expect(instance.boundaryTable).toBe('admin_boundaries');
    expect(instance.boundaryId).toBe(5);
    expect(instance.boundaryGeomCol).toBe('the_geom');
  });
});
