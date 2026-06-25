import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class GetAdresseByClickUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(coord: [number, number]) {
    return this.adressageService.getAdresseByClick(coord);
  }
}
