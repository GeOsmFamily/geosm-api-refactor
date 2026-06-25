import { BaseMapType } from '../enums.js';

export interface BaseMapProps {
  id: string;
  name: string;
  slug: string;
  type: BaseMapType;
  url: string;
  thumbnail: string | null;
  attribution: string | null;
  isDefault: boolean;
  order: number;
  config: Record<string, unknown> | null;
  instanceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BaseMap {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: BaseMapType;
  readonly url: string;
  readonly thumbnail: string | null;
  readonly attribution: string | null;
  readonly isDefault: boolean;
  readonly order: number;
  readonly config: Record<string, unknown> | null;
  readonly instanceId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: BaseMapProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.type = props.type;
    this.url = props.url;
    this.thumbnail = props.thumbnail;
    this.attribution = props.attribution;
    this.isDefault = props.isDefault;
    this.order = props.order;
    this.config = props.config;
    this.instanceId = props.instanceId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
