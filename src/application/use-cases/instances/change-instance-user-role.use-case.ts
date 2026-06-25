import { IInstanceRepository, InstanceUserRecord } from '../../../domain/repositories/instance.repository.js';
import { ChangeInstanceUserRoleDTO } from '../../dtos/instance.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class ChangeInstanceUserRoleUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(instanceId: string, userId: string, dto: ChangeInstanceUserRoleDTO): Promise<InstanceUserRecord> {
    const existing = await this.instanceRepository.findInstanceUser(instanceId, userId);
    if (!existing) throw new NotFoundError('InstanceUser');
    return this.instanceRepository.changeInstanceUserRole(instanceId, userId, dto.role);
  }
}
