import { LogoutDTO } from '../../dtos/auth.dto.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';

export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(dto: LogoutDTO): Promise<void> {
    const token = await this.refreshTokenRepository.findByToken(dto.refreshToken);
    if (token) {
      await this.refreshTokenRepository.revokeAllByFamily(token.family);
    }
  }
}
