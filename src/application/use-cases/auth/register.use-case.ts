import { v4 as uuidv4 } from 'uuid';
import { RegisterDTO, UserProfileDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { IEmailService } from '../../services/email.service.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';
import { Email } from '../../../domain/value-objects/email.vo.js';

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly emailService: IEmailService,
  ) {}

  async execute(dto: RegisterDTO): Promise<UserProfileDTO> {
    const email = Email.create(dto.email);

    const existingUser = await this.userRepository.existsByEmail(email.value);
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.create({
      id: uuidv4(),
      email: email.value,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: null,
      role: Role.VIEWER,
      isActive: true,
      emailVerifiedAt: null,
      lastLoginAt: null,
    });

    const verificationToken = uuidv4();
    await this.emailService.sendVerificationEmail(user.email, verificationToken);

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
