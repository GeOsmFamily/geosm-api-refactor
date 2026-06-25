import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { CreateUserDTO, UserResponseDTO } from '../../dtos/user.dto.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';
import { Email } from '../../../domain/value-objects/email.vo.js';

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
  ) {}

  async execute(dto: CreateUserDTO): Promise<UserResponseDTO> {
    const email = Email.create(dto.email);
    const exists = await this.userRepository.existsByEmail(email.value);
    if (exists) throw new ConflictError('Email already in use');

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.userRepository.create({
      id: uuidv4(),
      email: email.value,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: null,
      role: dto.role ?? Role.VIEWER,
      isActive: true,
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
    });

    return {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      avatar: user.avatar, role: user.role, isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt, lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  }
}
