import { PrismaClient, InstanceFaqStatus } from '@prisma/client';

export interface InstanceFaqRecord {
  id: string;
  instanceId: string;
  question: string;
  answer: string;
  sourceCount: number;
  status: InstanceFaqStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  generatedAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstanceFaqData {
  instanceId: string;
  question: string;
  answer: string;
  sourceCount: number;
}

export class PrismaInstanceFaqRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createMany(entries: CreateInstanceFaqData[]): Promise<{ count: number }> {
    return this.prisma.instanceFaq.createMany({ data: entries });
  }

  findById(id: string): Promise<InstanceFaqRecord | null> {
    return this.prisma.instanceFaq.findUnique({ where: { id } });
  }

  listByInstanceAndStatus(
    instanceId: string,
    status: InstanceFaqStatus,
  ): Promise<InstanceFaqRecord[]> {
    return this.prisma.instanceFaq.findMany({
      where: { instanceId, status },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(
    id: string,
    data: {
      status: InstanceFaqStatus;
      reviewedBy: string;
      question?: string;
      answer?: string;
    },
  ): Promise<InstanceFaqRecord> {
    return this.prisma.instanceFaq.update({
      where: { id },
      data: {
        ...data,
        reviewedAt: new Date(),
        publishedAt: data.status === InstanceFaqStatus.PUBLISHED ? new Date() : undefined,
      },
    });
  }
}
