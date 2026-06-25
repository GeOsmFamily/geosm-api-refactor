import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class GetPointsUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(coord: [number, number], nomRue: string) {
    return this.adressageService.getPoints(coord, nomRue);
  }
}
