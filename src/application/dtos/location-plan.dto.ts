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
  includeLegend?: boolean;
  includeScale?: boolean;
  includeGrid?: boolean;
  includeNorthArrow?: boolean;
  autoFillWithAI?: boolean;
  /** Point de départ optionnel - si fourni (avec originLat), déclenche le calcul d'un
   * itinéraire d'accès (OSRM + altimétrie + rédaction IA), voir CreateLocationPlanUseCase. */
  originLon?: number;
  originLat?: number;
}
