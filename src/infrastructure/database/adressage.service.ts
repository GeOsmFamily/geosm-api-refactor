import { PrismaClient } from '@prisma/client';

export interface AdresseResult {
  geometry: unknown;
  [key: string]: unknown;
}

export interface PointResult {
  arrondissement: string;
  nom_voie: string;
  geometry: unknown;
  construction: string;
  proprietaire: string;
  quartier: string;
  numero_porte: string;
  nom: string;
}

export interface CodeUsageResult {
  code: string;
  designation: string;
}

export class AdressageService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAdresse(schema: string, table: string, geom: string): Promise<AdresseResult[]> {
    const s = schema.replace(/[^a-zA-Z0-9_]/g, '');
    const t = table.replace(/[^a-zA-Z0-9_]/g, '');
    const safeGeom = geom.replace(/'/g, "''");
    const rows = await this.prisma.$queryRawUnsafe<
      { props: Record<string, unknown>; geometry: string }[]
    >(
      `SELECT (to_jsonb(t) - 'geom') AS props, ST_AsGeoJSON(t.geom) AS geometry FROM "${s}"."${t}" t WHERE ST_Within(ST_SetSRID(t.geom, 4326), ST_SetSRID(ST_GeomFromText('${safeGeom}'), 4326))`,
    );
    return rows.map((r) => ({ ...r.props, geometry: r.geometry }) as AdresseResult);
  }

  async getPosition(adresse: string): Promise<{ geometry: unknown }[]> {
    const safeAdresse = adresse.replace(/'/g, "''");
    const results = await this.prisma.$queryRawUnsafe<{ geometry: unknown }[]>(
      `SELECT ST_AsGeoJSON(adressage.fournit_position_yde('${safeAdresse}')) AS geometry`,
    );
    return results;
  }

  async getPoints(coord: [number, number], nomRue: string): Promise<PointResult[]> {
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    const rows = await this.prisma.$queryRawUnsafe<
      (PointResult & { st_intersects: boolean; nom_voie: string })[]
    >(
      `SELECT arrondissement, nom_voie, ST_AsGeoJSON(point_adresse) AS geometry, designation_construct AS construction, proprietaire, quartier, numero_porte, designation_nature_occupation AS nom, ST_Intersects(point_adresse, ST_Buffer(ST_GeographyFromText('SRID=4326;POINT(${lon} ${lat})'), 20)) AS st_intersects FROM adressage.base_formate`,
    );
    const normalizedRue = nomRue.replace(/\s+/g, '').toUpperCase();
    return rows.filter(
      (r) => r.st_intersects && r.nom_voie.replace(/\s+/g, '').toUpperCase() === normalizedRue,
    );
  }

  async searchAdresse(usage: string): Promise<AdresseResult[]> {
    const safeUsage = usage.replace(/'/g, "''");
    const results = await this.prisma.$queryRawUnsafe<AdresseResult[]>(
      `SELECT arrondissement, nom_voie, ST_AsGeoJSON(point_adresse) AS geometry, designation_construct AS construction, proprietaire, quartier, numero_porte, designation_nature_occupation AS nom FROM adressage.base_formate WHERE code_usage = '${safeUsage}' AND point_adresse IS NOT NULL`,
    );
    return results;
  }

  async getAdresseByClick(coord: [number, number]): Promise<string> {
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    const voie = await this.prisma.$queryRawUnsafe<{ id_voie: number }[]>(
      `SELECT id_voie FROM adressage.voies WHERE ST_DWithin(trace, 'POINT(${lon} ${lat})'::geography, 50) ORDER BY ST_Distance(trace, 'POINT(${lon} ${lat})'::geography)`,
    );
    if (voie.length === 0) return 'off';
    const adresse = await this.prisma.$queryRawUnsafe<{ founit_adresse_yde: string }[]>(
      `SELECT adressage.founit_adresse_yde(${voie[0].id_voie}, ${lon}, ${lat})`,
    );
    return adresse[0]?.founit_adresse_yde ?? 'off';
  }

  async getCodeUsage(): Promise<CodeUsageResult[][]> {
    const codes = await this.prisma.$queryRawUnsafe<{ code: string }[]>(
      `SELECT DISTINCT code_usage AS code FROM adressage.base_formate`,
    );
    const result: CodeUsageResult[][] = [];
    for (const { code } of codes) {
      const safeCode = code.replace(/'/g, "''");
      const usage = await this.prisma.$queryRawUnsafe<CodeUsageResult[]>(
        `SELECT designation, code FROM adressage.code_usage WHERE code = '${safeCode}'`,
      );
      result.push(usage);
    }
    return result;
  }

  async getElasticData(
    data: { shema: string; table: string; key_couche: string; id: number }[],
  ): Promise<AdresseResult[]> {
    const results: AdresseResult[] = [];
    for (const item of data) {
      const s = item.shema.replace(/[^a-zA-Z0-9_]/g, '');
      const t = item.table.replace(/[^a-zA-Z0-9_]/g, '');
      const rawRows = await this.prisma.$queryRawUnsafe<
        { props: Record<string, unknown>; geometry: string }[]
      >(
        `SELECT (to_jsonb(t) - 'geom') AS props, ST_AsGeoJSON(t.geom) AS geometry FROM "${s}"."${t}" t WHERE t.id = ${Number(item.id)}`,
      );
      const flat = rawRows.map((r) => ({ ...r.props, geometry: r.geometry }) as AdresseResult);
      if (flat[0]) {
        flat[0].shema = s;
        flat[0].key_couche = item.key_couche;
        results.push(flat[0]);
      }
    }
    return results;
  }
}
