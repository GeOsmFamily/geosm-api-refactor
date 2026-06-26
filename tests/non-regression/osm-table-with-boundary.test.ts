import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOsmTableUseCase } from '../../src/application/use-cases/osm/create-osm-table.use-case.js';
import { Instance } from '../../src/domain/entities/instance.entity.js';

describe('CreateOsmTableUseCase boundary non-regression', () => {
  let osmQueryService: { createTable: ReturnType<typeof vi.fn> };
  let instanceRepository: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    osmQueryService = { createTable: vi.fn().mockResolvedValue({ rowCount: 10 }) };
    instanceRepository = { findById: vi.fn() };
  });

  it('should apply boundary filter when instance has boundary', async () => {
    const instance = new Instance({
      id: 'inst-1',
      name: 'Test',
      slug: 'test',
      description: null,
      logo: null,
      bbox: null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 10,
      boundaryTable: 'admin_boundaries',
      boundaryId: 42,
      boundaryGeomCol: 'the_geom',
      adminLevel: null,
      parentInstanceId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    instanceRepository.findById.mockResolvedValue(instance);

    const useCase = new CreateOsmTableUseCase(osmQueryService as any, instanceRepository as any);
    await useCase.execute({
      schema: 'osm',
      table: 'buildings',
      conditions: [{ key: 'building', value: 'yes' }],
      instanceId: 'inst-1',
    });

    const passedOptions = osmQueryService.createTable.mock.calls[0][0];
    expect(passedOptions.boundaryTable).toBe('admin_boundaries');
    expect(passedOptions.boundaryId).toBe(42);
    expect(passedOptions.boundaryGeomColumn).toBe('the_geom');
  });

  it('should apply bbox when instance has bbox but no boundary', async () => {
    const instance = new Instance({
      id: 'inst-2',
      name: 'Test2',
      slug: 'test2',
      description: null,
      logo: null,
      bbox: [1, 2, 3, 4],
      centerLat: null,
      centerLon: null,
      defaultZoom: 10,
      boundaryTable: null,
      boundaryId: null,
      boundaryGeomCol: null,
      adminLevel: null,
      parentInstanceId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    instanceRepository.findById.mockResolvedValue(instance);

    const useCase = new CreateOsmTableUseCase(osmQueryService as any, instanceRepository as any);
    await useCase.execute({
      schema: 'osm',
      table: 'roads',
      conditions: [{ key: 'highway', value: 'primary' }],
      instanceId: 'inst-2',
    });

    const passedOptions = osmQueryService.createTable.mock.calls[0][0];
    expect(passedOptions.bbox).toEqual([1, 2, 3, 4]);
    expect(passedOptions.boundaryTable).toBeUndefined();
  });

  it('should not override explicit boundaryTable from options', async () => {
    const instance = new Instance({
      id: 'inst-3',
      name: 'Test3',
      slug: 'test3',
      description: null,
      logo: null,
      bbox: null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 10,
      boundaryTable: 'from_instance',
      boundaryId: 99,
      boundaryGeomCol: 'geom',
      adminLevel: null,
      parentInstanceId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    instanceRepository.findById.mockResolvedValue(instance);

    const useCase = new CreateOsmTableUseCase(osmQueryService as any, instanceRepository as any);
    await useCase.execute({
      schema: 'osm',
      table: 'pois',
      conditions: [{ key: 'amenity', value: 'cafe' }],
      instanceId: 'inst-3',
      boundaryTable: 'explicit_boundary',
    });

    const passedOptions = osmQueryService.createTable.mock.calls[0][0];
    // Should keep the explicit value, not override from instance
    expect(passedOptions.boundaryTable).toBe('explicit_boundary');
  });

  it('should throw when schema or table is missing', async () => {
    const useCase = new CreateOsmTableUseCase(osmQueryService as any);
    await expect(useCase.execute({
      schema: '',
      table: 'test',
      conditions: [{ key: 'k', value: 'v' }],
    })).rejects.toThrow('Schema and table name are required');
  });

  it('should throw when no conditions provided', async () => {
    const useCase = new CreateOsmTableUseCase(osmQueryService as any);
    await expect(useCase.execute({
      schema: 'osm',
      table: 'test',
      conditions: [],
    })).rejects.toThrow('At least one key/value condition is required');
  });
});
