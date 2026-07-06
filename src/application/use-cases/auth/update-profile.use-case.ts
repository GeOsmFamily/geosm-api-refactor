import { UpdateProfileDTO, UserProfileDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateProfileUseCase');

export class UpdateProfileUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, dto: UpdateProfileDTO): Promise<UserProfileDTO> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updated = await this.userRepository.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: dto.avatar,
    });
    logger.info('Profile updated', { userId });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatar: updated.avatar,
      role: updated.role,
      isActive: updated.isActive,
      emailVerifiedAt: updated.emailVerifiedAt,
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
