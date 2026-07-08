import { PrismaClient, User as PrismaUser, Prisma } from '@prisma/client';
import {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
} from '../../../domain/repositories/user.repository.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Role } from '../../../domain/enums.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    isActive?: boolean;
  }): Promise<{ data: User[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (options?.search) {
      where.OR = [
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options?.role) where.role = options.role;
    if (options?.isActive !== undefined) where.isActive = options.isActive;

    const [records, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);

    return { data: records.map((r) => this.toDomain(r)), total };
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        id: data.id,
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar,
        role: data.role,
        isActive: data.isActive,
        emailVerifiedAt: data.emailVerifiedAt,
        lastLoginAt: data.lastLoginAt,
      },
    });
    return this.toDomain(record);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const record = await this.prisma.user.update({ where: { id }, data });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  private toDomain(record: PrismaUser): User {
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      firstName: record.firstName,
      lastName: record.lastName,
      avatar: record.avatar,
      role: record.role as Role,
      isActive: record.isActive,
      emailVerifiedAt: record.emailVerifiedAt,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
