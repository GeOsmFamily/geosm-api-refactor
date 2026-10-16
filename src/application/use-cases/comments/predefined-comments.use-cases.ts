import type {
  PredefinedCommentRecord,
  PrismaPredefinedCommentRepository,
} from '../../../infrastructure/database/repositories/prisma-predefined-comment.repository.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { Role } from '../../../domain/enums.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { logSocialEvent } from '../../../infrastructure/observability/social-telemetry.js';

const logger = createChildLogger('PredefinedCommentsUseCases');

export interface Actor {
  userId: string;
  role: Role;
}

/**
 * Commentaires predefinis par instance (chantier D, regle R4) : liste publique triee pour l'outil
 * « Ajouter un commentaire », gestion reservee au super-administrateur et aux administrateurs de
 * l'instance concernee. Le commentaire envoye reste un texte libre : POST /comments ne sait pas
 * s'il vient d'un predefini.
 */
export class PredefinedCommentsUseCases {
  constructor(
    private readonly repository: PrismaPredefinedCommentRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async list(instanceId: string): Promise<PredefinedCommentRecord[]> {
    await this.requireInstance(instanceId);
    return this.repository.listByInstance(instanceId);
  }

  async listForAdmin(actor: Actor, instanceId: string): Promise<PredefinedCommentRecord[]> {
    await this.requireManager(actor, instanceId);
    return this.repository.listByInstance(instanceId);
  }

  async create(
    actor: Actor,
    instanceId: string,
    dto: { label: string; order?: number },
  ): Promise<PredefinedCommentRecord> {
    await this.requireManager(actor, instanceId);
    const order = dto.order ?? (await this.repository.nextOrder(instanceId));
    const created = await this.repository.create({ instanceId, label: dto.label.trim(), order });
    logSocialEvent(
      logger,
      'info',
      'comment.predefined_created',
      { userId: actor.userId, instanceId },
      { predefinedCommentId: created.id },
    );
    return created;
  }

  async update(
    actor: Actor,
    instanceId: string,
    id: string,
    dto: { label?: string; order?: number },
  ): Promise<PredefinedCommentRecord> {
    await this.requireManager(actor, instanceId);
    await this.requireOwned(instanceId, id);
    return this.repository.update(id, {
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    });
  }

  async remove(actor: Actor, instanceId: string, id: string): Promise<void> {
    await this.requireManager(actor, instanceId);
    await this.requireOwned(instanceId, id);
    await this.repository.delete(id);
    logSocialEvent(
      logger,
      'info',
      'comment.predefined_deleted',
      { userId: actor.userId, instanceId },
      { predefinedCommentId: id },
    );
  }

  private async requireInstance(instanceId: string): Promise<void> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);
  }

  /** Super-administrateur, ou administrateur de CETTE instance (pas d'une autre). */
  private async requireManager(actor: Actor, instanceId: string): Promise<void> {
    await this.requireInstance(instanceId);
    if (actor.role === Role.SUPER_ADMIN) return;
    if (
      actor.role === Role.ADMIN_INSTANCE &&
      (await this.repository.isInstanceAdmin(actor.userId, instanceId))
    ) {
      return;
    }
    throw new ForbiddenError("Vous n'administrez pas cette instance");
  }

  private async requireOwned(instanceId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing || existing.instanceId !== instanceId) {
      throw new NotFoundError('PredefinedComment', id);
    }
  }
}
