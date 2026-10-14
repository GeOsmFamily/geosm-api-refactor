export interface CreateLayerGroupDTO {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
}

export interface UpdateLayerGroupDTO {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface ReorderLayerGroupsDTO {
  orders: Array<{ id: string; order: number }>;
}
