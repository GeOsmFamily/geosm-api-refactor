import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateInstanceTemplateUseCase');

export interface InstanceTemplateInput {
  name: string;
  slug: string;
  description?: string;
  thematiques?: string[];
}

export class CreateInstanceTemplateUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(input: InstanceTemplateInput) {
    // Create instance
    const instance = await this.instanceRepository.create({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      logo: null,
      bbox: null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 6,
      boundaryTable: null,
      boundaryId: null,
      boundaryGeomCol: null,
      adminLevel: null,
      parentInstanceId: null,
      isActive: true,
    });

    // Create default thematiques/groups
    const defaultThematiques = input.thematiques ?? ['Environnement', 'Transport', 'Administration', 'Urbanisme'];

    for (let i = 0; i < defaultThematiques.length; i++) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "Group" (id, name, color, icon, "order", "instanceId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), '${defaultThematiques[i].replace(/'/g, "''")}', '#3B82F6', 'folder', ${i}, '${String(instance.id)}', NOW(), NOW())`
      );
    }

    logger.info('Instance template created', { instanceId: instance.id, slug: instance.slug, thematiquesCount: defaultThematiques.length });
    return instance;
  }
}
