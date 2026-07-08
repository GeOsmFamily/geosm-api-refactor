import { LocationPlan } from '../entities/location-plan.entity.js';

export interface ILocationPlanRepository {
  findById(id: string): Promise<LocationPlan | null>;
  create(data: Omit<LocationPlan, 'createdAt' | 'updatedAt'>): Promise<LocationPlan>;
  update(
    id: string,
    data: Partial<Omit<LocationPlan, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LocationPlan>;
}
