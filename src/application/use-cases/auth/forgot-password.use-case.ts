import { v4 as uuidv4 } from 'uuid';
import { ForgotPasswordDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IEmailService } from '../../services/email.service.js';

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(dto: ForgotPasswordDTO): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    // Always return success to prevent email enumeration
    if (!user) {
      return;
    }
    const resetToken = uuidv4();
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }
}
