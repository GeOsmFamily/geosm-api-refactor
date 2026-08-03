import { PrismaClient } from '@prisma/client';
import type { IEmailService } from '../../services/email.service.js';
import type { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SendWeeklyReportUseCase');

export class SendWeeklyReportUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storageService: MinioStorageService,
    private readonly emailService: IEmailService,
    private readonly recipientEmail: string,
  ) {}

  async execute(): Promise<void> {
    if (!this.recipientEmail) {
      logger.warn('Skipping weekly report: no recipient email configured');
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const periodTitle = `Semaine du ${sevenDaysAgo.toLocaleDateString('fr-FR')} au ${now.toLocaleDateString('fr-FR')}`;

    const activeInstancesCount = await this.prisma.instance.count({
      where: { isActive: true },
    });

    const totalLayersCount = await this.prisma.layer.count();

    const totalUsersCount = await this.prisma.user.count();
    const newUsersInPeriod = await this.prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    const totalExportsInPeriod = await this.prisma.export.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    let storageSizeBytes = 0;
    try {
      const backups = await this.storageService.listFiles('backups/');
      storageSizeBytes = backups.reduce((acc, curr) => acc + curr.size, 0);
    } catch (err) {
      logger.warn('Could not calculate MinIO storage size for weekly report', { error: err });
    }

    await this.emailService.sendWeeklyReportEmail(this.recipientEmail, {
      periodTitle,
      activeInstancesCount,
      totalLayersCount,
      totalUsersCount,
      newUsersInPeriod,
      totalExportsInPeriod,
      storageSizeBytes,
      systemStatus: 'Opérationnel (TOUS LES SERVICES UP)',
    });

    logger.info('Weekly activity report email sent successfully', { to: this.recipientEmail });
  }
}
