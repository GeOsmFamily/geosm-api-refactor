import { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { localize } from '../../utils/localize.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('IndexLayerUseCase');
const LAYERS_INDEX = 'layers';

/**
 * Indexe une couche dans MeiliSearch pour la recherche (voir SearchLayersUseCase/
 * GlobalSearchUseCase). name/description sont stockés en JSON multilingue ({fr,en}, voir
 * CreateInstanceUseCase) - indexer cette chaîne brute cassait la pertinence (MeiliSearch
 * tokenisait de la syntaxe JSON plutôt que les mots réels) et faisait fuiter le JSON brut
 * dans les résultats de recherche. On indexe donc name_fr/name_en explicitement (recherche
 * dans les deux langues) en plus de `name` (toujours localisé en fr par défaut, pour les
 * consommateurs qui ne relocalisent pas la réponse).
 */
export class IndexLayerUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(layer: Layer): Promise<void> {
    const document = {
      id: layer.id,
      name: localize(layer.name, 'fr'),
      name_fr: localize(layer.name, 'fr'),
      name_en: localize(layer.name, 'en'),
      slug: layer.slug,
      description: localize(layer.description, 'fr') || null,
      description_fr: localize(layer.description, 'fr') || null,
      description_en: localize(layer.description, 'en') || null,
      geometryType: layer.geometryType,
      instanceId: layer.instanceId,
      subGroupId: layer.subGroupId,
      metadata: layer.metadata,
    };
    await this.meiliSearchService.addDocuments(LAYERS_INDEX, [document], 'id');
    logger.debug('Layer indexed in MeiliSearch', { layerId: layer.id });
  }
}
