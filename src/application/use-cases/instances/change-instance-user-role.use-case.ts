import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { ChangeInstanceUserRoleDTO } from '../../dtos/instance.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ChangeInstanceUserRoleUseCase');

export class ChangeInstanceUserRoleUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string, userId: string, dto: ChangeInstanceUserRoleDTO): Promise<InstanceUserRecord> {
    const existing = await this.instanceRepository.findInstanceUser(instanceId, userId);
    if (!existing) throw new NotFoundError('InstanceUser');
    const updated = await this.instanceRepository.changeInstanceUserRole(instanceId, userId, dto.role);
    logger.info('Instance user role changed', { instanceId, userId, fromRole: existing.role, toRole: dto.role });
    return updated;
  }
}
