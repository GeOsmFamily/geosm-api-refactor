import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { ListUsersDTO, UserResponseDTO } from '../../dtos/user.dto.js';
import { User } from '../../../domain/entities/user.entity.js';

export class ListUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(dto: ListUsersDTO): Promise<{ data: UserResponseDTO[]; total: number }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const result = await this.userRepository.findAll({ page, limit, search: dto.search, role: dto.role, isActive: dto.isActive });
    return { data: result.data.map(this.toResponse), total: result.total };
  }

  private toResponse(user: User): UserResponseDTO {
    return {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      avatar: user.avatar, role: user.role, isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt, lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  }
}
