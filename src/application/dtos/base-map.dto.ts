import { BaseMapType } from '../../domain/enums.js';

export interface CreateBaseMapDTO {
  name: string;
  slug: string;
  type: BaseMapType;
  url: string;
  thumbnail?: string;
  attribution?: string;
  isDefault?: boolean;
  order?: number;
  config?: Record<string, unknown>;
}

export interface UpdateBaseMapDTO {
  name?: string;
  url?: string;
  thumbnail?: string | null;
  attribution?: string | null;
  isDefault?: boolean;
  order?: number;
  config?: Record<string, unknown> | null;
}
