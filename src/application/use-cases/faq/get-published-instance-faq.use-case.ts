import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import type { PrismaInstanceFaqRepository } from '../../../infrastructure/database/repositories/prisma-instance-faq.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface PublicFaqEntry {
  id: string;
  question: string;
  answer: string;
}

/** Route publique GET /faq/:instanceSlug (voir sharing.routes.ts pour le même principe de
 * résolution par slug sans authentification) - ne retourne QUE les entrées PUBLISHED, jamais
 * les DRAFT/REJECTED qui peuvent refléter des questions sensibles non validées. */
export class GetPublishedInstanceFaqUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly instanceFaqRepository: PrismaInstanceFaqRepository,
  ) {}

  async execute(instanceSlug: string): Promise<PublicFaqEntry[]> {
    const instance = await this.instanceRepository.findBySlug(instanceSlug);
    if (!instance) throw new NotFoundError('Instance', instanceSlug);

    const faqs = await this.instanceFaqRepository.listByInstanceAndStatus(
      instance.id,
      'PUBLISHED',
    );
    return faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }));
  }
}
