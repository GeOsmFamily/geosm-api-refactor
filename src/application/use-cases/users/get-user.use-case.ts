import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { UserResponseDTO } from '../../dtos/user.dto.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: string): Promise<UserResponseDTO> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      avatar: user.avatar, role: user.role, isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt, lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  }
}
