import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class GetAdresseUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(schema: string, table: string, geom: string) {
    return this.adressageService.getAdresse(schema, table, geom);
  }
}
