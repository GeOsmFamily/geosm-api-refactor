import type { PrismaInstanceFaqRepository } from '../../../infrastructure/database/repositories/prisma-instance-faq.repository.js';
import type { InstanceFaqRecord } from '../../../infrastructure/database/repositories/prisma-instance-faq.repository.js';

/** Liste les FAQ en attente de revue pour une instance - utilisée par la page admin de revue
 * avant publication (voir ReviewInstanceFaqUseCase pour la décision publier/refuser). */
export class ListDraftInstanceFaqUseCase {
  constructor(private readonly instanceFaqRepository: PrismaInstanceFaqRepository) {}

  execute(instanceId: string): Promise<InstanceFaqRecord[]> {
    return this.instanceFaqRepository.listByInstanceAndStatus(instanceId, 'DRAFT');
  }
}
