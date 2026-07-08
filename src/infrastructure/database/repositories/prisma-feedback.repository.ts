import { PrismaClient, FeedbackType, FeedbackStatus } from '@prisma/client';

export interface FeedbackRecord {
  id: string;
  type: FeedbackType;
  description: string;
  contactEmail: string | null;
  page: string | null;
  userId: string | null;
  status: FeedbackStatus;
  adminNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CreateFeedbackData {
  id: string;
  type: FeedbackType;
  description: string;
  contactEmail: string | null;
  page: string | null;
  userId: string | null;
}

export interface AdminListFeedbackOptions {
  page?: number;
  limit?: number;
  type?: FeedbackType;
  status?: FeedbackStatus;
}

export class PrismaFeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateFeedbackData): Promise<FeedbackRecord> {
    return this.prisma.feedbackSubmission.create({ data });
  }

  async findById(id: string): Promise<FeedbackRecord | null> {
    return this.prisma.feedbackSubmission.findUnique({ where: { id } });
  }

  async adminList(
    options: AdminListFeedbackOptions,
  ): Promise<{ data: FeedbackRecord[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (options.type) where.type = options.type;
    if (options.status) where.status = options.status;

    const [data, total] = await Promise.all([
      this.prisma.feedbackSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.feedbackSubmission.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(
    id: string,
    status: FeedbackStatus,
    adminNotes?: string | null,
  ): Promise<FeedbackRecord> {
    return this.prisma.feedbackSubmission.update({
      where: { id },
      data: { status, adminNotes, reviewedAt: new Date() },
    });
  }
}
