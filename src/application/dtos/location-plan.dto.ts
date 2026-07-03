import { PaperSize, PlanOrientation } from '../../domain/enums.js';

export interface CreateLocationPlanDTO {
  instanceId: string;
  title: string;
  description?: string;
  landmark?: string;
  lon: number;
  lat: number;
  scale?: number;
  paperSize?: PaperSize;
  orientation?: PlanOrientation;
}
