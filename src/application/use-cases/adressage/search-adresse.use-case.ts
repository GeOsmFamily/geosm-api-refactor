import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class SearchAdresseUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute(usage: string) {
    return this.adressageService.searchAdresse(usage);
  }
}
