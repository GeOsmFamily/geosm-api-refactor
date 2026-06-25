import { ResetPasswordDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(dto: ResetPasswordDTO): Promise<void> {
    // In full implementation, token maps to a password reset record
    // For Phase 1, token is the user ID
    const userId = dto.token;
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    await this.userRepository.update(userId, { passwordHash });
    await this.refreshTokenRepository.revokeAllByUserId(userId);
  }
}
