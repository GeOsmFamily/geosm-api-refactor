export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_INSTANCE = 'ADMIN_INSTANCE',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum GeometryType {
  POINT = 'POINT',
  LINESTRING = 'LINESTRING',
  POLYGON = 'POLYGON',
  MULTIPOINT = 'MULTIPOINT',
  MULTILINESTRING = 'MULTILINESTRING',
  MULTIPOLYGON = 'MULTIPOLYGON',
}

export enum SourceType {
  WMS = 'WMS',
  WFS = 'WFS',
  WMTS = 'WMTS',
  GEOJSON = 'GEOJSON',
  MVT = 'MVT',
  XYZ = 'XYZ',
}

export enum ActionType {
  DOWNLOAD = 'DOWNLOAD',
  SHARE = 'SHARE',
  PRINT = 'PRINT',
  MEASURE = 'MEASURE',
  ROUTING = 'ROUTING',
  COMMENT = 'COMMENT',
}

export enum ExportFormat {
  GEOJSON = 'GEOJSON',
  SHAPEFILE = 'SHAPEFILE',
  GEOPACKAGE = 'GEOPACKAGE',
  KML = 'KML',
  CSV = 'CSV',
  PDF = 'PDF',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum BaseMapType {
  XYZ = 'XYZ',
  WMS = 'WMS',
  WMTS = 'WMTS',
  MAPBOX = 'MAPBOX',
}
