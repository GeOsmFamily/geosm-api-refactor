import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import type { GenerateInstanceFaqUseCase } from './generate-instance-faq.use-case.js';
import { logger } from '../../../infrastructure/observability/logger.js';

const LOOKBACK_DAYS = 30;

export interface ScheduledFaqGenerationResult {
  instancesProcessed: number;
  faqsCreated: number;
  instancesFailed: number;
}

/**
 * Job planifié (queue `faq-generation`, voir server.ts) : régénère un lot de FAQ en DRAFT pour
 * chaque instance active, à partir des conversations assistant IA des LOOKBACK_DAYS derniers
 * jours. Une instance sans nouvelle question ou en échec Gemini ne bloque jamais les autres -
 * même posture que ScheduledOsmImportUseCase (une entité en échec = un compteur, pas une
 * exception qui interrompt la boucle).
 */
export class ScheduledFaqGenerationUseCase {
  constructor(
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly generateInstanceFaqUseCase: GenerateInstanceFaqUseCase,
  ) {}

  async execute(): Promise<ScheduledFaqGenerationResult> {
    const result: ScheduledFaqGenerationResult = {
      instancesProcessed: 0,
      faqsCreated: 0,
      instancesFailed: 0,
    };
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const { data: instances } = await this.instanceRepository.findAll({
      isActive: true,
      limit: 1000,
    });

    for (const instance of instances) {
      try {
        const { created } = await this.generateInstanceFaqUseCase.execute(instance.id, since);
        result.instancesProcessed++;
        result.faqsCreated += created;
      } catch (error) {
        result.instancesFailed++;
        logger.error('Échec de la génération de FAQ pour une instance', {
          instanceId: instance.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    logger.info('Génération de FAQ programmée terminée', result);
    return result;
  }
}
