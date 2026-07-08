import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchAdresseUseCase');

export class SearchAdresseUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(usage: string) {
    logger.debug('Searching adresse by usage', { usage });
    return this.adressageService.searchAdresse(usage);
  }
}
