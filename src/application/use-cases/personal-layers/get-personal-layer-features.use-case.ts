import { PrismaPersonalLayerRepository } from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { PostGISService, GeoJSONFeatureCollection } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

/** Réservé aux couches FILE (rendu vectoriel client) - une couche QGIS_PROJECT se rend via son
 * propre WMS (sourceUrl construit côté frontend depuis qgisProjectPath/sourceLayerName), pas via
 * cet endpoint. Vérifie la propriété avant de renvoyer quoi que ce soit (même logique que
 * DeletePersonalLayerUseCase - une donnée personnelle ne doit jamais fuiter vers un autre user). */
export class GetPersonalLayerFeaturesUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(userId: string, personalLayerId: string): Promise<GeoJSONFeatureCollection> {
    const layer = await this.personalLayerRepository.findById(personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', personalLayerId);
    if (layer.userId !== userId) {
      throw new ForbiddenError("Cette donnée ne vous appartient pas.");
    }
    if (layer.sourceType !== 'FILE' || !layer.schemaName || !layer.tableName) {
      throw new ValidationError("Cette donnée n'a pas de features vectorielles interrogeables.", {});
    }

    return this.postGISService.queryFeatures({
      schema: layer.schemaName,
      table: layer.tableName,
      limit: 5000,
    });
  }
}
