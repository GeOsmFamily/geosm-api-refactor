export interface SubGroupProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SubGroup {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly icon: string | null;
  readonly order: number;
  readonly isActive: boolean;
  readonly groupId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SubGroupProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.icon = props.icon;
    this.order = props.order;
    this.isActive = props.isActive;
    this.groupId = props.groupId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
