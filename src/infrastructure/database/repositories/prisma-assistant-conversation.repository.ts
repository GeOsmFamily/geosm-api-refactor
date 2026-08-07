import { PrismaClient, Prisma } from '@prisma/client';

export interface AssistantMessageRecord {
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  // Couches réellement interrogées pour produire cette réponse (voir AssistantSourceRef côté
  // assistant-chat.use-case.ts) - persisté pour que les citations de source survivent à la
  // réouverture d'une conversation, pas seulement à l'échange en direct.
  sources?: { layerId: string; layerName: string }[];
}

export interface AssistantConversationRecord {
  id: string;
  userId: string;
  instanceId: string;
  title: string;
  messages: Prisma.JsonValue;
  geometryCache: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaAssistantConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    userId: string;
    instanceId: string;
    title: string;
  }): Promise<AssistantConversationRecord> {
    return this.prisma.assistantConversation.create({
      data: { ...data, messages: [] },
    }) as Promise<AssistantConversationRecord>;
  }

  async findById(id: string): Promise<AssistantConversationRecord | null> {
    return this.prisma.assistantConversation.findUnique({
      where: { id },
    }) as Promise<AssistantConversationRecord | null>;
  }

  async findByUserAndInstance(
    userId: string,
    instanceId: string,
  ): Promise<AssistantConversationRecord[]> {
    return this.prisma.assistantConversation.findMany({
      where: { userId, instanceId },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<AssistantConversationRecord[]>;
  }

  /** Toutes les conversations d'une instance depuis une date donnée, tous utilisateurs confondus -
   * scope volontairement plus large que findByUserAndInstance (limité à un seul utilisateur),
   * nécessaire pour GenerateInstanceFaqUseCase qui doit regrouper les questions de TOUS les
   * visiteurs de l'instance pour en dégager une FAQ représentative. */
  async findAllByInstance(
    instanceId: string,
    options: { since: Date },
  ): Promise<AssistantConversationRecord[]> {
    return this.prisma.assistantConversation.findMany({
      where: { instanceId, updatedAt: { gte: options.since } },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<AssistantConversationRecord[]>;
  }

  async update(
    id: string,
    data: {
      title?: string;
      messages?: Prisma.InputJsonValue;
      geometryCache?: Prisma.InputJsonValue;
    },
  ): Promise<AssistantConversationRecord> {
    return this.prisma.assistantConversation.update({
      where: { id },
      data,
    }) as Promise<AssistantConversationRecord>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.assistantConversation.delete({ where: { id } });
  }
}
