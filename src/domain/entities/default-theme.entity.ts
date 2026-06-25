export interface DefaultThemeProps {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DefaultTheme {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly icon: string | null;
  readonly color: string | null;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: DefaultThemeProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.icon = props.icon;
    this.color = props.color;
    this.order = props.order;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
