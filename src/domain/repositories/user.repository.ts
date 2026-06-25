import { User, UserProps } from '../entities/user.entity.js';

export type CreateUserData = Omit<UserProps, 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>>;

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}
