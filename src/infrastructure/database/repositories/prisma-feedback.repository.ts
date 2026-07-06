import { PrismaClient, FeedbackType } from '@prisma/client';

export interface FeedbackRecord {
  id: string;
  type: FeedbackType;
  description: string;
  contactEmail: string | null;
  page: string | null;
  userId: string | null;
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

export class PrismaFeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateFeedbackData): Promise<FeedbackRecord> {
    return this.prisma.feedbackSubmission.create({ data });
  }
}
