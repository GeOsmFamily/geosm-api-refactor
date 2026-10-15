import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetPreferredInstanceUseCase } from '../../../../../src/application/use-cases/users/set-preferred-instance.use-case.js';
import { Instance, type InstanceProps } from '../../../../../src/domain/entities/instance.entity.js';
import { InstanceKind } from '../../../../../src/domain/enums.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { metricsRegister } from '../../../../../src/infrastructure/observability/metrics.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

const now = new Date();
function instance(over: Partial<InstanceProps> = {}): Instance {
  return new Instance({
    id: 'inst-1', name: 'Cameroun', slug: 'cameroon', description: null, logo: null, bbox: null,
    centerLat: null, centerLon: null, defaultZoom: 6, boundaryTable: null, boundaryId: null,
    boundaryGeomCol: null, adminLevel: null, parentInstanceId: null, isActive: true,
    createdAt: now, updatedAt: now, ...over,
  });
}

describe('SetPreferredInstanceUseCase', () => {
  let userRepo: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let instanceRepo: { findById: ReturnType<typeof vi.fn> };
  let useCase: SetPreferredInstanceUseCase;

  beforeEach(() => {
    userRepo = { findById: vi.fn().mockResolvedValue({ id: 'u1' }), update: vi.fn().mockResolvedValue({}) };
    instanceRepo = { findById: vi.fn().mockResolvedValue(instance()) };
    useCase = new SetPreferredInstanceUseCase(userRepo as never, instanceRepo as never);
  });

  it('memorise un pays actif', async () => {
    const result = await useCase.execute('u1', 'inst-1');
    expect(result).toEqual({ preferredInstanceId: 'inst-1' });
    expect(userRepo.update).toHaveBeenCalledWith('u1', { preferredInstanceId: 'inst-1' });
  });

  it('compte le choix dans geosm_social_instance_selections_total', async () => {
    await useCase.execute('u1', 'inst-1');
    const text = await metricsRegister.metrics();
    expect(text).toMatch(/geosm_social_instance_selections_total{instance_id="inst-1"} [1-9]/);
  });

  it('efface la preference avec null, sans consulter les instances', async () => {
    await useCase.execute('u1', null);
    expect(userRepo.update).toHaveBeenCalledWith('u1', { preferredInstanceId: null });
    expect(instanceRepo.findById).not.toHaveBeenCalled();
  });

  it('refuse un pays non disponible (RG-B-03)', async () => {
    instanceRepo.findById.mockResolvedValue(instance({ isActive: false }));
    await expect(useCase.execute('u1', 'inst-1')).rejects.toBeInstanceOf(ConflictError);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('refuse un continent', async () => {
    instanceRepo.findById.mockResolvedValue(instance({ kind: InstanceKind.CONTINENT }));
    await expect(useCase.execute('u1', 'inst-1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('leve NotFoundError pour un utilisateur ou une instance inconnus', async () => {
    instanceRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('u1', 'ghost')).rejects.toBeInstanceOf(NotFoundError);
    userRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('nobody', null)).rejects.toBeInstanceOf(NotFoundError);
  });
});
