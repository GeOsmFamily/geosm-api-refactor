import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReindexAllLayersUseCase } from '../../../../../src/application/use-cases/search/reindex-all-layers.use-case.js';
import type { PrismaInstanceRepository } from '../../../../../src/infrastructure/database/repositories/prisma-instance.repository.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { IndexLayerUseCase } from '../../../../../src/application/use-cases/search/index-layer.use-case.js';
import type { MeiliSearchService } from '../../../../../src/infrastructure/external-apis/meilisearch.service.js';

/**
 * Non-régression pour l'audit des données personnelles (voir plan "Interopérabilité &
 * sécurité des données" du 2026-08-06) : ReindexAllLayersUseCase ne doit JAMAIS pouvoir
 * indexer une PersonalLayer (donnée privée par défaut) dans MeiliSearch, qui est interrogé
 * sans filtre de propriétaire côté recherche publique. Le constructeur n'accepte d'ailleurs
 * aucun repository de données personnelles - ce test documente et fige cette garantie au
 * niveau comportemental, pas seulement au niveau des types.
 */
describe('ReindexAllLayersUseCase - non-régression données personnelles', () => {
  let useCase: ReindexAllLayersUseCase;
  let instanceRepository: Pick<PrismaInstanceRepository, 'findAll'>;
  let layerRepository: Pick<ILayerRepository, 'findByInstance'>;
  let indexLayerUseCase: Pick<IndexLayerUseCase, 'execute'>;
  let meiliSearchService: Pick<MeiliSearchService, 'updateFilterableAttributes'>;

  const catalogLayer = { id: 'layer-1', name: 'Hôpitaux', instanceId: 'inst-1' };

  beforeEach(() => {
    instanceRepository = {
      findAll: vi.fn().mockResolvedValue({ data: [{ id: 'inst-1' }], total: 1 }),
    };
    layerRepository = {
      findByInstance: vi.fn().mockResolvedValue({ data: [catalogLayer], total: 1 }),
    };
    indexLayerUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    meiliSearchService = { updateFilterableAttributes: vi.fn().mockResolvedValue(undefined) };

    useCase = new ReindexAllLayersUseCase(
      instanceRepository as PrismaInstanceRepository,
      layerRepository as ILayerRepository,
      indexLayerUseCase as IndexLayerUseCase,
      meiliSearchService as MeiliSearchService,
    );
  });

  it('ne consulte que le repository de couches du catalogue, jamais de données personnelles', async () => {
    await useCase.execute();

    expect(layerRepository.findByInstance).toHaveBeenCalledWith('inst-1', { limit: 1000 });
    // Toute donnée passée à indexLayerUseCase.execute() vient exclusivement de
    // layerRepository.findByInstance() (voir mock ci-dessus) - il n'existe aucun chemin dans
    // le use case menant à une PersonalLayer.
    expect(indexLayerUseCase.execute).toHaveBeenCalledTimes(1);
    expect(indexLayerUseCase.execute).toHaveBeenCalledWith(catalogLayer);
  });

  it("n'expose aucune dépendance vers un repository de données personnelles (garantie au niveau du constructeur)", () => {
    // 4 dépendances exactement : instance/layer/indexLayer/meiliSearch - un ajout futur d'un
    // 5e paramètre (ex. personalLayerRepository) ferait échouer ce test, signalant explicitement
    // qu'il faut revérifier ce chantier avant de l'accepter.
    expect(useCase.execute.length).toBe(0); // execute() ne prend aucun paramètre lié à une portée utilisateur
    expect(ReindexAllLayersUseCase.length).toBe(4);
  });
});
