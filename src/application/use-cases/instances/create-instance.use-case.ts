import { v4 as uuidv4 } from 'uuid';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { CreateInstanceDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';

export class CreateInstanceUseCase {
  constructor(private readonly instanceRepository: IInstanceRepository) {}

  async execute(dto: CreateInstanceDTO): Promise<Instance> {
    const slug = Slug.create(dto.slug);
    const existing = await this.instanceRepository.findBySlug(slug.value);
    if (existing) throw new ConflictError('Instance with this slug already exists');

    return this.instanceRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      logo: dto.logo ?? null,
      bbox: dto.bbox ?? null,
      centerLat: dto.centerLat ?? null,
      centerLon: dto.centerLon ?? null,
      defaultZoom: dto.defaultZoom ?? 6,
      isActive: true,
    });
  }
}
