import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetPositionUseCase');

export class GetPositionUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(adresse: string) {
    logger.debug('Getting position for address', { adresse });
    return this.adressageService.getPosition(adresse);
  }
}
