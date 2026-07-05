import type { PrismaAnalyticsRepository } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { localize } from '../../utils/localize.js';

export interface LayerSuggestion {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Suggestions de recherche contextuelles (v1 "cadrée" du plan IA - voir plan initial) :
 * classement déterministe par fréquence d'activation passée, PAS d'appel Gemini par frappe
 * clavier (coût/latence). Priorité aux couches déjà activées par CET utilisateur dans cette
 * instance ; repli sur les couches les plus activées par l'ensemble des utilisateurs de
 * l'instance si l'utilisateur n'a pas encore d'historique personnel (démarrage à froid).
 */
export class GetSearchSuggestionsUseCase {
  constructor(
    private readonly analyticsRepository: PrismaAnalyticsRepository,
    private readonly layerRepository: ILayerRepository,
  ) {}

  async execute(userId: string | undefined, instanceId: string, limit = 5, lang = 'fr'): Promise<LayerSuggestion[]> {
    let ranked = userId
      ? await this.analyticsRepository.getTopActivatedLayersForUser(userId, instanceId, limit)
      : [];

    if (ranked.length === 0) {
      ranked = await this.analyticsRepository.getTopActivatedLayersForInstance(instanceId, limit);
    }

    const suggestions: LayerSuggestion[] = [];
    for (const r of ranked) {
      const layer = await this.layerRepository.findById(r.layerId);
      if (layer) suggestions.push({ id: layer.id, name: localize(layer.name, lang), description: localize(layer.description, lang) || null });
    }
    return suggestions;
  }
}
