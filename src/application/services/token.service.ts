import { JwtPayload, AuthTokensDTO } from '../dtos/auth.dto.js';

export interface ITokenService {
  generateAccessToken(payload: JwtPayload): string;
  generateRefreshToken(): string;
  verifyAccessToken(token: string): JwtPayload;
  generateTokenPair(payload: JwtPayload): AuthTokensDTO;
}
