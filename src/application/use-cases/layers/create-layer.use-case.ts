import { v4 as uuidv4 } from 'uuid';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { CreateLayerDTO } from '../../dtos/layer.dto.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { IndexLayerUseCase } from '../search/index-layer.use-case.js';

export class CreateLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly indexLayerUseCase?: IndexLayerUseCase,
  ) {}

  async execute(instanceId: string, dto: CreateLayerDTO): Promise<Layer> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const slug = Slug.create(dto.slug);
    const existing = await this.layerRepository.findBySlug(slug.value, instanceId);
    if (existing) throw new ConflictError('Layer with this slug already exists in this instance');

    const layer = await this.layerRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      geometryType: dto.geometryType,
      sourceType: dto.sourceType,
      sourceUrl: dto.sourceUrl ?? null,
      sourceLayer: dto.sourceLayer ?? null,
      tableName: dto.tableName ?? null,
      schemaName: dto.schemaName ?? null,
      minZoom: dto.minZoom ?? 0,
      maxZoom: dto.maxZoom ?? 22,
      isVisible: dto.isVisible ?? true,
      isQueryable: dto.isQueryable ?? true,
      opacity: dto.opacity ?? 1.0,
      order: dto.order ?? 0,
      metadata: dto.metadata ?? null,
      subGroupId: dto.subGroupId,
      instanceId,
      qgisProjectId: null,
    });

    try {
      await this.indexLayerUseCase?.execute(layer);
    } catch {
      // Non-critical: indexing failure should not block layer creation
    }

    return layer;
  }
}
