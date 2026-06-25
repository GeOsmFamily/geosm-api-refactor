export interface CreateSubGroupDTO {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface UpdateSubGroupDTO {
  name?: string;
  description?: string | null;
  icon?: string | null;
  order?: number;
  isActive?: boolean;
}
