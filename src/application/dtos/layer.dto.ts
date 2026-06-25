import { GeometryType, SourceType } from '../../domain/enums.js';

export interface ListLayersDTO {
  page?: number;
  limit?: number;
  search?: string;
  geometryType?: GeometryType;
  subGroupId?: string;
}

export interface CreateLayerDTO {
  name: string;
  slug: string;
  description?: string;
  geometryType: GeometryType;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceLayer?: string;
  tableName?: string;
  schemaName?: string;
  minZoom?: number;
  maxZoom?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
  opacity?: number;
  order?: number;
  metadata?: Record<string, unknown>;
  subGroupId: string;
}

export interface UpdateLayerDTO {
  name?: string;
  description?: string | null;
  sourceUrl?: string | null;
  sourceLayer?: string | null;
  tableName?: string | null;
  schemaName?: string | null;
  minZoom?: number;
  maxZoom?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
  opacity?: number;
  order?: number;
  metadata?: Record<string, unknown> | null;
}
