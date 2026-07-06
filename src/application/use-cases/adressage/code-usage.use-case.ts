import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CodeUsageUseCase');

export class CodeUsageUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute() {
    logger.debug('Code usage lookup requested');
    return this.adressageService.getCodeUsage();
  }
}
