import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { InstanceKind } from '../../../domain/enums.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { logSocialEvent } from '../../../infrastructure/observability/social-telemetry.js';

const logger = createChildLogger('SetPreferredInstanceUseCase');

/**
 * Memorise le pays choisi par un utilisateur connecte (RG-B-05) pour le restaurer a chaque visite.
 * `null` efface la preference. Un pays « non disponible » (inactif) ou un continent ne peuvent pas
 * etre choisis (RG-B-03).
 */
export class SetPreferredInstanceUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(userId: string, instanceId: string | null): Promise<{ preferredInstanceId: string | null }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    if (instanceId !== null) {
      const instance = await this.instanceRepository.findById(instanceId);
      if (!instance) throw new NotFoundError('Instance', instanceId);
      if (instance.kind === InstanceKind.CONTINENT) {
        throw new ConflictError('Un continent ne peut pas etre choisi comme pays');
      }
      if (!instance.isActive) {
        throw new ConflictError("Ce pays n'est pas encore disponible");
      }
    }

    await this.userRepository.update(userId, { preferredInstanceId: instanceId });
    logSocialEvent(logger, 'info', 'instance.selected', { userId, instanceId });
    return { preferredInstanceId: instanceId };
  }
}
