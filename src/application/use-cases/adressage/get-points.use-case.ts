import { AdressageService } from '../../../infrastructure/database/adressage.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetPointsUseCase');

export class GetPointsUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(coord: [number, number], nomRue: string) {
    logger.debug('Points lookup requested', { coord, nomRue });
    return this.adressageService.getPoints(coord, nomRue);
  }
}
