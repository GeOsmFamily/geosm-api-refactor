import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DownloadExportUseCase');

export class DownloadExportUseCase {
  constructor(
    private exportRepository: {
      findById: (
        id: string,
      ) => Promise<{ id: string; status: string; filePath: string | null; userId: string } | null>;
    },
    private storageService: { getPresignedUrl: (key: string, expiry?: number) => Promise<string> },
  ) {}

  async execute(exportId: string, userId: string): Promise<{ downloadUrl: string }> {
    const exportRecord = await this.exportRepository.findById(exportId);
    if (!exportRecord) throw new NotFoundError('Export', exportId);
    if (exportRecord.userId !== userId) {
      logger.warn('Download export rejected: not the owner', {
        requestingUserId: userId,
        ownerId: exportRecord.userId,
        exportId,
      });
      throw new ForbiddenError('You do not have access to this export');
    }
    if (exportRecord.status !== 'COMPLETED' || !exportRecord.filePath) {
      throw new ValidationError('Export is not ready for download', {});
    }

    const downloadUrl = await this.storageService.getPresignedUrl(exportRecord.filePath, 3600);
    logger.info('Export download URL generated', { userId, exportId });
    return { downloadUrl };
  }
}
