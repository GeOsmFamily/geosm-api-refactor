export interface CreateLayerSubGroupDTO {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface UpdateLayerSubGroupDTO {
  name?: string;
  description?: string | null;
  icon?: string | null;
  order?: number;
  isActive?: boolean;
}
