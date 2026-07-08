import { User, UserProps } from '../entities/user.entity.js';
import { Role } from '../enums.js';

export type CreateUserData = Omit<UserProps, 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>>;

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    isActive?: boolean;
  }): Promise<{ data: User[]; total: number }>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}
