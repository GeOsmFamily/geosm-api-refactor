import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetAdresseUseCase');

export class GetAdresseUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(schema: string, table: string, geom: string) {
    logger.debug('Adresse lookup requested', { schema, table });
    return this.adressageService.getAdresse(schema, table, geom);
  }
}
