import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestPersonalLayerPublicationUseCase } from '../../../../../src/application/use-cases/personal-layers/request-personal-layer-publication.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('RequestPersonalLayerPublicationUseCase', () => {
  let useCase: RequestPersonalLayerPublicationUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; requestPublication: ReturnType<typeof vi.fn> };
  let alertingService: { sendAlert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), requestPublication: vi.fn() };
    alertingService = { sendAlert: vi.fn().mockResolvedValue(undefined) };
    useCase = new RequestPersonalLayerPublicationUseCase(repository as any, alertingService as any);
  });

  it('should throw NotFoundError when the personal layer does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when the layer belongs to another user', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'someone-else', status: 'PRIVATE' });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ForbiddenError);
  });

  it('should throw ValidationError when the layer is already published or pending', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      status: 'PENDING_PUBLICATION',
    });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ValidationError);
    expect(repository.requestPublication).not.toHaveBeenCalled();
  });

  it('should request publication and alert the team for a PRIVATE layer', async () => {
    const layer = {
      id: 'pl-1',
      userId: 'user-1',
      status: 'PRIVATE',
      name: 'Mon jeu de données',
      instanceId: 'instance-1',
      groupName: 'Group',
      subGroupName: 'SubGroup',
      sourceType: 'FILE',
    };
    const updated = { ...layer, status: 'PENDING_PUBLICATION' };
    repository.findById.mockResolvedValue(layer);
    repository.requestPublication.mockResolvedValue(updated);

    const result = await useCase.execute('user-1', 'pl-1', 'Merci de valider');

    expect(repository.requestPublication).toHaveBeenCalledWith('pl-1', 'Merci de valider');
    expect(alertingService.sendAlert).toHaveBeenCalledWith(
      'WARNING',
      expect.stringContaining('Mon jeu de données'),
      'Merci de valider',
      expect.objectContaining({ personalLayerId: 'pl-1', userId: 'user-1' }),
    );
    expect(result).toBe(updated);
  });

  it('should allow re-requesting publication for a REJECTED layer', async () => {
    const layer = {
      id: 'pl-2',
      userId: 'user-1',
      status: 'REJECTED',
      name: 'Autre couche',
      instanceId: 'instance-1',
      groupName: 'Group',
      subGroupName: 'SubGroup',
      sourceType: 'QGIS_PROJECT',
    };
    repository.findById.mockResolvedValue(layer);
    repository.requestPublication.mockResolvedValue({ ...layer, status: 'PENDING_PUBLICATION' });

    await useCase.execute('user-1', 'pl-2');

    expect(repository.requestPublication).toHaveBeenCalledWith('pl-2', undefined);
    expect(alertingService.sendAlert).toHaveBeenCalledWith(
      'WARNING',
      expect.any(String),
      expect.stringContaining('souhaite publier'),
      expect.any(Object),
    );
  });
});
