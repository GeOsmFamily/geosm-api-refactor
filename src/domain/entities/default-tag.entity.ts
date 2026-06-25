export interface DefaultTagProps {
  id: string;
  name: string;
  slug: string;
  themeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DefaultTag {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly themeId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: DefaultTagProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.themeId = props.themeId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
