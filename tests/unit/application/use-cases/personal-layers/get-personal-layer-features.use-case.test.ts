import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPersonalLayerFeaturesUseCase } from '../../../../../src/application/use-cases/personal-layers/get-personal-layer-features.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('GetPersonalLayerFeaturesUseCase', () => {
  let useCase: GetPersonalLayerFeaturesUseCase;
  let repository: { findById: ReturnType<typeof vi.fn> };
  let postGISService: { queryFeatures: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn() };
    postGISService = { queryFeatures: vi.fn() };
    useCase = new GetPersonalLayerFeaturesUseCase(repository as any, postGISService as any);
  });

  it('should throw NotFoundError when the personal layer does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when the layer belongs to another user', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'someone-else',
      sourceType: 'FILE',
      schemaName: 'personal_data',
      tableName: 'pl_1',
    });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ForbiddenError);
  });

  it('should throw ValidationError for a QGIS_PROJECT-sourced layer', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'QGIS_PROJECT',
      schemaName: null,
      tableName: null,
    });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when a FILE layer is missing its table metadata', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'FILE',
      schemaName: null,
      tableName: null,
    });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ValidationError);
  });

  it('should query PostGIS features for a valid FILE-sourced layer', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'FILE',
      schemaName: 'personal_data',
      tableName: 'pl_1',
    });
    const featureCollection = { type: 'FeatureCollection', features: [] };
    postGISService.queryFeatures.mockResolvedValue(featureCollection);

    const result = await useCase.execute('user-1', 'pl-1');

    expect(postGISService.queryFeatures).toHaveBeenCalledWith({
      schema: 'personal_data',
      table: 'pl_1',
      limit: 5000,
    });
    expect(result).toBe(featureCollection);
  });
});
