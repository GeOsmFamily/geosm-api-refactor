import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteUserUseCase');

export class DeleteUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    await this.userRepository.delete(id);
    logger.warn('User deleted by admin', { userId: id, email: user.email });
  }
}
