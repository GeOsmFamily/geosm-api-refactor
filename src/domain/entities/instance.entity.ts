export interface InstanceProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  bbox: number[] | null;
  centerLat: number | null;
  centerLon: number | null;
  defaultZoom: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Instance {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly logo: string | null;
  readonly bbox: number[] | null;
  readonly centerLat: number | null;
  readonly centerLon: number | null;
  readonly defaultZoom: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: InstanceProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.logo = props.logo;
    this.bbox = props.bbox;
    this.centerLat = props.centerLat;
    this.centerLon = props.centerLon;
    this.defaultZoom = props.defaultZoom;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
