import { RefreshToken, RefreshTokenProps } from '../entities/refresh-token.entity.js';

export type CreateRefreshTokenData = Omit<RefreshTokenProps, 'createdAt'>;

export interface IRefreshTokenRepository {
  findByToken(token: string): Promise<RefreshToken | null>;
  create(data: CreateRefreshTokenData): Promise<RefreshToken>;
  revokeByToken(token: string, replacedByToken?: string): Promise<void>;
  revokeAllByFamily(family: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
