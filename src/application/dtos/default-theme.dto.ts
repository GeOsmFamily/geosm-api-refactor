export interface CreateDefaultThemeDTO {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  order?: number;
}

export interface UpdateDefaultThemeDTO {
  name?: string;
  icon?: string | null;
  color?: string | null;
  order?: number;
}

export interface CreateDefaultTagDTO {
  name: string;
  slug: string;
}
