import { ActionType } from '../enums.js';

export interface LayerActionProps {
  id: string;
  type: ActionType;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
  layerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LayerAction {
  readonly id: string;
  readonly type: ActionType;
  readonly isEnabled: boolean;
  readonly config: Record<string, unknown> | null;
  readonly layerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LayerActionProps) {
    this.id = props.id;
    this.type = props.type;
    this.isEnabled = props.isEnabled;
    this.config = props.config;
    this.layerId = props.layerId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
