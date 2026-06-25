import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class GetPositionUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(adresse: string) {
    return this.adressageService.getPosition(adresse);
  }
}
