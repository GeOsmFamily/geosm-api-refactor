export interface QgisProjectProps {
  id: string;
  name: string;
  filePath: string;
  description: string | null;
  instanceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class QgisProject {
  readonly id: string;
  readonly name: string;
  readonly filePath: string;
  readonly description: string | null;
  readonly instanceId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: QgisProjectProps) {
    this.id = props.id;
    this.name = props.name;
    this.filePath = props.filePath;
    this.description = props.description;
    this.instanceId = props.instanceId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
