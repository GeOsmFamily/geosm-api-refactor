export interface CreateGroupDTO {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface ReorderGroupsDTO {
  orders: Array<{ id: string; order: number }>;
}
