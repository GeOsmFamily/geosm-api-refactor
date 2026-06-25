import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class DeleteSubGroupUseCase {
  constructor(private readonly subGroupRepository: ISubGroupRepository) {}

  async execute(id: string): Promise<void> {
    const subGroup = await this.subGroupRepository.findById(id);
    if (!subGroup) throw new NotFoundError('SubGroup', id);
    await this.subGroupRepository.delete(id);
  }
}
