import type {
  PrismaInstanceFaqRepository,
  InstanceFaqRecord,
} from '../../../infrastructure/database/repositories/prisma-instance-faq.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface ReviewInstanceFaqInput {
  reviewerId: string;
  faqId: string;
  decision: 'PUBLISH' | 'REJECT';
  // Un admin peut corriger la formulation avant publication (ex: une réponse trop vague générée
  // par Gemini) plutôt que de devoir refuser puis attendre une nouvelle génération.
  question?: string;
  answer?: string;
}

/** Valide ou refuse une FAQ générée automatiquement (voir GenerateInstanceFaqUseCase). Calqué
 * sur ReviewPersonalLayerPublicationUseCase, le seul autre vrai workflow de revue humaine avant
 * publication déjà présent dans le code - même garde sur le statut courant, même triplet
 * reviewedBy/reviewedAt. */
export class ReviewInstanceFaqUseCase {
  constructor(private readonly instanceFaqRepository: PrismaInstanceFaqRepository) {}

  async execute(input: ReviewInstanceFaqInput): Promise<InstanceFaqRecord> {
    const faq = await this.instanceFaqRepository.findById(input.faqId);
    if (!faq) throw new NotFoundError('InstanceFaq', input.faqId);
    if (faq.status !== 'DRAFT') {
      throw new ValidationError('Cette FAQ a déjà été traitée.', {});
    }

    return this.instanceFaqRepository.updateStatus(input.faqId, {
      status: input.decision === 'PUBLISH' ? 'PUBLISHED' : 'REJECTED',
      reviewedBy: input.reviewerId,
      question: input.question,
      answer: input.answer,
    });
  }
}
