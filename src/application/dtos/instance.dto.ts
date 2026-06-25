import { Role } from '../../domain/enums.js';

export interface ListInstancesDTO {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateInstanceDTO {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  bbox?: number[];
  centerLat?: number;
  centerLon?: number;
  defaultZoom?: number;
  boundaryTable?: string;
  boundaryId?: number;
  boundaryGeomCol?: string;
  adminLevel?: number;
  parentInstanceId?: string;
}

export interface UpdateInstanceDTO {
  name?: string;
  description?: string | null;
  logo?: string | null;
  bbox?: number[];
  centerLat?: number | null;
  centerLon?: number | null;
  defaultZoom?: number;
  isActive?: boolean;
}

export interface AddInstanceUserDTO {
  userId: string;
  role?: Role;
}

export interface ChangeInstanceUserRoleDTO {
  role: Role;
}

export interface InstanceUserResponseDTO {
  id: string;
  userId: string;
  instanceId: string;
  role: Role;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
