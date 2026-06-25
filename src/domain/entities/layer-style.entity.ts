export interface LayerStyleProps {
  id: string;
  name: string;
  sldBody: string | null;
  mapboxStyle: Record<string, unknown> | null;
  isDefault: boolean;
  layerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LayerStyle {
  readonly id: string;
  readonly name: string;
  readonly sldBody: string | null;
  readonly mapboxStyle: Record<string, unknown> | null;
  readonly isDefault: boolean;
  readonly layerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LayerStyleProps) {
    this.id = props.id;
    this.name = props.name;
    this.sldBody = props.sldBody;
    this.mapboxStyle = props.mapboxStyle;
    this.isDefault = props.isDefault;
    this.layerId = props.layerId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
