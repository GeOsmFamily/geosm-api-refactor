import { describe, it, expect } from 'vitest';
import { User } from '../../../../src/domain/entities/user.entity.js';
import { Role } from '../../../../src/domain/enums.js';

describe('User Entity', () => {
  const now = new Date();
  const props = {
    id: 'u1', email: 'test@example.com', passwordHash: 'hash',
    firstName: 'John', lastName: 'Doe', avatar: null,
    role: Role.VIEWER, isActive: true, emailVerifiedAt: now,
    lastLoginAt: null, createdAt: now, updatedAt: now,
  };

  it('should construct with all properties', () => {
    const user = new User(props);
    expect(user.id).toBe('u1');
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe(Role.VIEWER);
    expect(user.isActive).toBe(true);
  });

  it('should compute fullName', () => {
    const user = new User(props);
    expect(user.fullName).toBe('John Doe');
  });

  it('should compute isEmailVerified', () => {
    const user = new User(props);
    expect(user.isEmailVerified).toBe(true);
    const user2 = new User({ ...props, emailVerifiedAt: null });
    expect(user2.isEmailVerified).toBe(false);
  });
});
