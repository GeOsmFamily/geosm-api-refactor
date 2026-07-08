import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { UpdateUserDTO, UserResponseDTO } from '../../dtos/user.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateUserUseCase');

export class UpdateUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: string, dto: UpdateUserDTO): Promise<UserResponseDTO> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw new NotFoundError('User', id);

    const user = await this.userRepository.update(id, dto);
    logger.info('User updated by admin', { userId: id });
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
