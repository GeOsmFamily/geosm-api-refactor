import { ILocationPlanRepository } from '../../../domain/repositories/location-plan.repository.js';
import { LocationPlan } from '../../../domain/entities/location-plan.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetLocationPlanUseCase {
  constructor(private readonly locationPlanRepository: ILocationPlanRepository) {}

  async execute(id: string): Promise<LocationPlan> {
    const record = await this.locationPlanRepository.findById(id);
    if (!record) throw new NotFoundError('LocationPlan', id);
    return record;
  }
}
