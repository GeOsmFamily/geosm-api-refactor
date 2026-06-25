import { ExportFormat } from '../../domain/enums.js';

export interface CreateExportDTO {
  format: ExportFormat;
  layerId: string;
  bbox?: number[];
}

export interface ListExportsDTO {
  page?: number;
  limit?: number;
  status?: string;
}
