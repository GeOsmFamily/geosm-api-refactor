import { Role } from '../../domain/enums.js';

export interface ListUsersDTO {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
  email?: string;
}

export interface ChangeUserRoleDTO {
  role: Role;
}

export interface ToggleUserActiveDTO {
  isActive: boolean;
}

export interface UserResponseDTO {
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
