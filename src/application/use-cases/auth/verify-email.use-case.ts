import { VerifyEmailDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: VerifyEmailDTO): Promise<void> {
    // In a full implementation, token would be looked up from a verification tokens table
    // For Phase 1, we verify by user ID encoded in the token
    const userId = dto.token;
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.emailVerifiedAt) {
      throw new ValidationError('Email is already verified');
    }
    await this.userRepository.update(userId, { emailVerifiedAt: new Date() });
  }
}
