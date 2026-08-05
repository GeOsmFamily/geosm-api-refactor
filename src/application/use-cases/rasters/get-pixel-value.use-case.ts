import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface PixelValueResult {
  value: number | null;
  /** Surface réelle de la cellule en m² (calculée à l'import, voir RasterService.getRasterInfo)
   * - absent pour les rasters importés avant ce champ, le frontend affiche alors la valeur brute
   * sans contexte de surface plutôt que d'échouer. */
  cellAreaM2: number | null;
}

/** Valeur au clic (synchrone, pas de job) - voir plan "Analyse raster". */
export class GetPixelValueUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(layerId: string, lon: number, lat: number): Promise<PixelValueResult> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);

    const isRaster = layer.metadata?.['source'] === 'raster';
    if (!isRaster || !layer.schemaName || !layer.tableName) {
      throw new ValidationError("Cette couche n'est pas un raster analysable", {});
    }

    const value = await this.postGISService.getPixelValue(
      layer.schemaName,
      layer.tableName,
      lon,
      lat,
    );
    const rasterInfo = layer.metadata?.['rasterInfo'] as { cellAreaM2?: number | null } | undefined;
    return { value, cellAreaM2: rasterInfo?.cellAreaM2 ?? null };
  }
}
