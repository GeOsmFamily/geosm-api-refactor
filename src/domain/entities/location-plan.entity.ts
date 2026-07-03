import { JobStatus, PaperSize, PlanOrientation } from '../enums.js';

export interface LocationPlanProps {
  id: string;
  userId: string;
  instanceId: string;
  status: JobStatus;
  title: string;
  description: string | null;
  landmark: string | null;
  lon: number;
  lat: number;
  scale: number | null;
  paperSize: PaperSize;
  orientation: PlanOrientation;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class LocationPlan {
  readonly id: string;
  readonly userId: string;
  readonly instanceId: string;
  readonly status: JobStatus;
  readonly title: string;
  readonly description: string | null;
  readonly landmark: string | null;
  readonly lon: number;
  readonly lat: number;
  readonly scale: number | null;
  readonly paperSize: PaperSize;
  readonly orientation: PlanOrientation;
  readonly filePath: string | null;
  readonly fileSize: number | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LocationPlanProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.instanceId = props.instanceId;
    this.status = props.status;
    this.title = props.title;
    this.description = props.description;
    this.landmark = props.landmark;
    this.lon = props.lon;
    this.lat = props.lat;
    this.scale = props.scale;
    this.paperSize = props.paperSize;
    this.orientation = props.orientation;
    this.filePath = props.filePath;
    this.fileSize = props.fileSize;
    this.errorMessage = props.errorMessage;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
