import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { AddInstanceUserDTO } from '../../dtos/instance.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';

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
    if (existing) throw new ConflictError('User is already a member of this instance');

    return this.instanceRepository.addInstanceUser(instanceId, dto.userId, dto.role ?? Role.VIEWER);
  }
}
