import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetAdresseByClickUseCase');

export class GetAdresseByClickUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(coord: [number, number]) {
    logger.debug('Adresse by click lookup requested', { coord });
    return this.adressageService.getAdresseByClick(coord);
  }
}
