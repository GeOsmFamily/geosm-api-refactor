import { JobStatus, PaperSize, PlanOrientation } from '../enums.js';

export interface LocationPlanRouteLeg {
  mode: 'driving' | 'walking';
  distanceMeters: number;
  durationSeconds: number;
  geometry: unknown;
}

export interface LocationPlanElevationSummary {
  ascentMeters: number;
  descentMeters: number;
  maxAltitudeMeters: number;
  terrainClass: 'plat' | 'vallonne' | 'accidente';
}

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
  includeLegend: boolean;
  includeScale: boolean;
  includeGrid: boolean;
  includeNorthArrow: boolean;
  originLon: number | null;
  originLat: number | null;
  accessInstructions: string | null;
  routeLegs: LocationPlanRouteLeg[] | null;
  elevationSummary: LocationPlanElevationSummary | null;
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
  readonly includeLegend: boolean;
  readonly includeScale: boolean;
  readonly includeGrid: boolean;
  readonly includeNorthArrow: boolean;
  readonly originLon: number | null;
  readonly originLat: number | null;
  readonly accessInstructions: string | null;
  readonly routeLegs: LocationPlanRouteLeg[] | null;
  readonly elevationSummary: LocationPlanElevationSummary | null;
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
    this.includeLegend = props.includeLegend;
    this.includeScale = props.includeScale;
    this.includeGrid = props.includeGrid;
    this.includeNorthArrow = props.includeNorthArrow;
    this.originLon = props.originLon;
    this.originLat = props.originLat;
    this.accessInstructions = props.accessInstructions;
    this.routeLegs = props.routeLegs;
    this.elevationSummary = props.elevationSummary;
    this.filePath = props.filePath;
    this.fileSize = props.fileSize;
    this.errorMessage = props.errorMessage;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
