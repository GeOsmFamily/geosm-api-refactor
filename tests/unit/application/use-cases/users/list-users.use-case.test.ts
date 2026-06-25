import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListUsersUseCase } from '../../../../../src/application/use-cases/users/list-users.use-case.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('ListUsersUseCase', () => {
  let useCase: ListUsersUseCase;
  let userRepository: IUserRepository;
  const now = new Date();

  const mockUsers = [
    new User({ id: '1', email: 'a@b.com', passwordHash: 'h', firstName: 'A', lastName: 'B', avatar: null, role: Role.VIEWER, isActive: true, emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now }),
    new User({ id: '2', email: 'c@d.com', passwordHash: 'h', firstName: 'C', lastName: 'D', avatar: null, role: Role.EDITOR, isActive: true, emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now }),
  ];

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), existsByEmail: vi.fn(),
      findAll: vi.fn().mockResolvedValue({ data: mockUsers, total: 2 }),
    };
    useCase = new ListUsersUseCase(userRepository);
  });

  it('should return paginated users', async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(userRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20, search: undefined, role: undefined, isActive: undefined });
  });

  it('should pass filters to repository', async () => {
    await useCase.execute({ page: 1, limit: 10, role: Role.EDITOR, isActive: true, search: 'test' });
    expect(userRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'test', role: Role.EDITOR, isActive: true });
  });
});
