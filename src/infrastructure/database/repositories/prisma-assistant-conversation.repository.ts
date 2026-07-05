import { PrismaClient, Prisma } from '@prisma/client';

export interface AssistantMessageRecord {
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export interface AssistantConversationRecord {
  id: string;
  userId: string;
  instanceId: string;
  title: string;
  messages: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaAssistantConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; userId: string; instanceId: string; title: string }): Promise<AssistantConversationRecord> {
    return this.prisma.assistantConversation.create({
      data: { ...data, messages: [] },
    }) as Promise<AssistantConversationRecord>;
  }

  async findById(id: string): Promise<AssistantConversationRecord | null> {
    return this.prisma.assistantConversation.findUnique({ where: { id } }) as Promise<AssistantConversationRecord | null>;
  }

  async findByUserAndInstance(userId: string, instanceId: string): Promise<AssistantConversationRecord[]> {
    return this.prisma.assistantConversation.findMany({
      where: { userId, instanceId },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<AssistantConversationRecord[]>;
  }

  async update(id: string, data: { title?: string; messages?: Prisma.InputJsonValue }): Promise<AssistantConversationRecord> {
    return this.prisma.assistantConversation.update({ where: { id }, data }) as Promise<AssistantConversationRecord>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.assistantConversation.delete({ where: { id } });
  }
}
