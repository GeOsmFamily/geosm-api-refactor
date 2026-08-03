import { PrismaClient } from '@prisma/client';
import type { IEmailService } from '../../services/email.service.js';
import type { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SendMonthlyReportUseCase');

export class SendMonthlyReportUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storageService: MinioStorageService,
    private readonly emailService: IEmailService,
    private readonly recipientEmail: string,
  ) {}

  async execute(): Promise<void> {
    if (!this.recipientEmail) {
      logger.warn('Skipping monthly report: no recipient email configured');
      return;
    }

    const now = new Date();
    const monthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

    const activeInstancesCount = await this.prisma.instance.count({
      where: { isActive: true },
    });

    const totalLayersCount = await this.prisma.layer.count();

    const totalUsersCount = await this.prisma.user.count();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newUsersInPeriod = await this.prisma.user.count({
      where: { createdAt: { gte: firstDayOfMonth } },
    });

    const totalExportsInPeriod = await this.prisma.export.count({
      where: { createdAt: { gte: firstDayOfMonth } },
    });

    let storageSizeBytes = 0;
    try {
      const backups = await this.storageService.listFiles('backups/');
      storageSizeBytes = backups.reduce((acc, curr) => acc + curr.size, 0);
    } catch (err) {
      logger.warn('Could not calculate MinIO storage size for monthly report', { error: err });
    }

    await this.emailService.sendMonthlyReportEmail(this.recipientEmail, {
      periodTitle: monthName,
      activeInstancesCount,
      totalLayersCount,
      totalUsersCount,
      newUsersInPeriod,
      totalExportsInPeriod,
      storageSizeBytes,
      systemStatus: 'Opérationnel (TOUS LES SERVICES UP)',
    });

    logger.info('Monthly activity report email sent successfully', { to: this.recipientEmail });
  }
}
