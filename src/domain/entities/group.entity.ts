export interface GroupProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  isActive: boolean;
  instanceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Group {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly icon: string | null;
  readonly color: string | null;
  readonly order: number;
  readonly isActive: boolean;
  readonly instanceId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: GroupProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.icon = props.icon;
    this.color = props.color;
    this.order = props.order;
    this.isActive = props.isActive;
    this.instanceId = props.instanceId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
