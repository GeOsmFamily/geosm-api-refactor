import { Role } from '../../domain/enums.js';

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RefreshDTO {
  refreshToken: string;
}

export interface LogoutDTO {
  refreshToken: string;
}

export interface VerifyEmailDTO {
  token: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfileDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: Role;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
