import { GeometryType, SourceType } from '../enums.js';

export interface LayerProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  geometryType: GeometryType;
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceLayer: string | null;
  tableName: string | null;
  schemaName: string | null;
  minZoom: number;
  maxZoom: number;
  isVisible: boolean;
  isQueryable: boolean;
  opacity: number;
  order: number;
  metadata: Record<string, unknown> | null;
  subGroupId: string;
  instanceId: string;
  qgisProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Layer {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly geometryType: GeometryType;
  readonly sourceType: SourceType;
  readonly sourceUrl: string | null;
  readonly sourceLayer: string | null;
  readonly tableName: string | null;
  readonly schemaName: string | null;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly isVisible: boolean;
  readonly isQueryable: boolean;
  readonly opacity: number;
  readonly order: number;
  readonly metadata: Record<string, unknown> | null;
  readonly subGroupId: string;
  readonly instanceId: string;
  readonly qgisProjectId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LayerProps) {
    Object.assign(this, props);
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.geometryType = props.geometryType;
    this.sourceType = props.sourceType;
    this.sourceUrl = props.sourceUrl;
    this.sourceLayer = props.sourceLayer;
    this.tableName = props.tableName;
    this.schemaName = props.schemaName;
    this.minZoom = props.minZoom;
    this.maxZoom = props.maxZoom;
    this.isVisible = props.isVisible;
    this.isQueryable = props.isQueryable;
    this.opacity = props.opacity;
    this.order = props.order;
    this.metadata = props.metadata;
    this.subGroupId = props.subGroupId;
    this.instanceId = props.instanceId;
    this.qgisProjectId = props.qgisProjectId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
