import { ILayerStyleRepository } from '../../../domain/repositories/layer-style.repository.js';

export class ResetLayerStyleUseCase {
  constructor(
    private readonly layerStyleRepository: ILayerStyleRepository,
  ) {}

  async execute(layerId: string): Promise<void> {
    const styles = await this.layerStyleRepository.findByLayerId(layerId);
    for (const style of styles) {
      if (!style.isDefault) {
        await this.layerStyleRepository.delete(style.id);
      }
    }
  }
}
