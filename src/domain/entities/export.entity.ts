import { ExportFormat, JobStatus } from '../enums.js';

export interface ExportProps {
  id: string;
  format: ExportFormat;
  status: JobStatus;
  layerId: string | null;
  layerIds: string[] | null;
  isBulk: boolean;
  userId: string;
  filePath: string | null;
  fileSize: number | null;
  bbox: number[] | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Export {
  readonly id: string;
  readonly format: ExportFormat;
  readonly status: JobStatus;
  readonly layerId: string | null;
  readonly layerIds: string[] | null;
  readonly isBulk: boolean;
  readonly userId: string;
  readonly filePath: string | null;
  readonly fileSize: number | null;
  readonly bbox: number[] | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ExportProps) {
    this.id = props.id;
    this.format = props.format;
    this.status = props.status;
    this.layerId = props.layerId;
    this.layerIds = props.layerIds;
    this.isBulk = props.isBulk;
    this.userId = props.userId;
    this.filePath = props.filePath;
    this.fileSize = props.fileSize;
    this.bbox = props.bbox;
    this.errorMessage = props.errorMessage;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
