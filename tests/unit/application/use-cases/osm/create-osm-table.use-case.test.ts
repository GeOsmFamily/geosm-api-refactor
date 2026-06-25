import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOsmTableUseCase } from '../../../../../src/application/use-cases/osm/create-osm-table.use-case.js';
import type { OsmQueryService } from '../../../../../src/infrastructure/database/osm-query.service.js';

describe('CreateOsmTableUseCase', () => {
  let useCase: CreateOsmTableUseCase;
  let osmQueryService: OsmQueryService;

  beforeEach(() => {
    osmQueryService = {
      createTable: vi.fn().mockResolvedValue({ count: 10, totalArea: null, totalLength: null, numPoints: 50 }),
    } as any;
    useCase = new CreateOsmTableUseCase(osmQueryService);
  });

  it('should create table and return stats', async () => {
    const result = await useCase.execute({
      schema: 'myschema',
      table: 'mytable',
      sourceTable: 'planet_osm_point',
      conditions: [{ key: 'amenity', value: 'hospital' }],
    });

    expect(result.count).toBe(10);
    expect(result.numPoints).toBe(50);
    expect(osmQueryService.createTable).toHaveBeenCalledOnce();
  });

  it('should throw when schema is missing', async () => {
    await expect(
      useCase.execute({
        schema: '',
        table: 'mytable',
        sourceTable: 'planet_osm_point',
        conditions: [{ key: 'amenity', value: 'hospital' }],
      }),
    ).rejects.toThrow('Schema and table name are required');
  });

  it('should throw when table is missing', async () => {
    await expect(
      useCase.execute({
        schema: 'myschema',
        table: '',
        sourceTable: 'planet_osm_point',
        conditions: [{ key: 'amenity', value: 'hospital' }],
      }),
    ).rejects.toThrow('Schema and table name are required');
  });

  it('should throw when conditions are empty', async () => {
    await expect(
      useCase.execute({
        schema: 'myschema',
        table: 'mytable',
        sourceTable: 'planet_osm_point',
        conditions: [],
      }),
    ).rejects.toThrow('At least one key/value condition is required');
  });
});
