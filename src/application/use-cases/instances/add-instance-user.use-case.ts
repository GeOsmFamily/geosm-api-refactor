import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { AddInstanceUserDTO } from '../../dtos/instance.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AddInstanceUserUseCase');

export class AddInstanceUserUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(instanceId: string, dto: AddInstanceUserDTO): Promise<InstanceUserRecord> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new NotFoundError('User', dto.userId);

    const existing = await this.instanceRepository.findInstanceUser(instanceId, dto.userId);
    if (existing) {
      logger.warn('Add instance user rejected: user already a member', { instanceId, userId: dto.userId });
      throw new ConflictError('User is already a member of this instance');
    }

    const instanceUser = await this.instanceRepository.addInstanceUser(instanceId, dto.userId, dto.role ?? Role.VIEWER);
    logger.info('User added to instance', { instanceId, userId: dto.userId, role: dto.role ?? Role.VIEWER });
    return instanceUser;
  }
}
