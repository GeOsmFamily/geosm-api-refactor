import { AdressageService } from '../../../infrastructure/database/adressage.service.js';

export class CodeUsageUseCase {
  constructor(private readonly adressageService: AdressageService) {}

  async execute() {
    return this.adressageService.getCodeUsage();
  }
}
