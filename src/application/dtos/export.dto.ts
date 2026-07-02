import { ExportFormat } from '../../domain/enums.js';

export interface CreateExportDTO {
  format: ExportFormat;
  layerId: string;
  bbox?: number[];
  /** Quand renseigné, exporte uniquement cette feature (osm_id) au lieu de toute la couche. */
  featureId?: string;
}

export interface CreateBulkExportDTO {
  format: ExportFormat;
  layerIds: string[];
}

export interface ListExportsDTO {
  page?: number;
  limit?: number;
  status?: string;
}
