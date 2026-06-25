import { Instance, type InstanceProps } from '../entities/instance.entity.js';
import { Role } from '../enums.js';

export interface InstanceUserRecord {
  id: string;
  userId: string;
  instanceId: string;
  role: Role;
  user?: { id: string; email: string; firstName: string; lastName: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstanceRepository {
  findById(id: string): Promise<Instance | null>;
  findBySlug(slug: string): Promise<Instance | null>;
  findAll(options?: { page?: number; limit?: number; search?: string; isActive?: boolean }): Promise<{ data: Instance[]; total: number }>;
  create(data: Omit<InstanceProps, 'createdAt' | 'updatedAt'>): Promise<Instance>;
  update(id: string, data: Partial<Omit<InstanceProps, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Instance>;
  delete(id: string): Promise<void>;
  findInstanceUsers(instanceId: string): Promise<InstanceUserRecord[]>;
  addInstanceUser(instanceId: string, userId: string, role: Role): Promise<InstanceUserRecord>;
  removeInstanceUser(instanceId: string, userId: string): Promise<void>;
  changeInstanceUserRole(instanceId: string, userId: string, role: Role): Promise<InstanceUserRecord>;
  findInstanceUser(instanceId: string, userId: string): Promise<InstanceUserRecord | null>;
}
