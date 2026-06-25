import { randomUUID } from 'crypto';
import { ITokenService } from '../../application/services/token.service.js';
import { JwtPayload, AuthTokensDTO } from '../../application/dtos/auth.dto.js';
import { jwtConfig } from '../../config/jwt.config.js';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error.js';
import type { FastifyInstance } from 'fastify';

export class JwtTokenService implements ITokenService {
  constructor(private readonly app: FastifyInstance) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.app.jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      { expiresIn: jwtConfig.accessExpiration },
    );
  }

  generateRefreshToken(): string {
    return randomUUID();
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = this.app.jwt.verify<{ sub: string; email: string; role: string }>(token);
      return {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role as JwtPayload['role'],
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  generateTokenPair(payload: JwtPayload): AuthTokensDTO {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(),
    };
  }
}
