import { BaseMapType } from '../enums.js';
import { config } from '../../config/env.config.js';

export interface DefaultBaseMapConfig {
  name: string;
  slug: string;
  type: BaseMapType;
  url: string;
  attribution: string;
  isDefault: boolean;
  order: number;
  config?: Record<string, unknown>;
}

/**
 * Fonds de carte créés par défaut pour chaque nouvelle instance.
 * Le token Mapbox (MAPBOX_ACCESS_TOKEN) est piloté par le backend et baké dans
 * l'URL en base — pas de configuration supplémentaire nécessaire côté client.
 */
export const defaultBaseMaps: DefaultBaseMapConfig[] = [
  {
    name: 'OSM Dark',
    slug: 'osm-dark',
    type: BaseMapType.XYZ,
    url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    isDefault: false,
    order: 1,
  },
  {
    // Fond topographique IGN (Géoplateforme). Servi en WMTS - la grille de tuiles
    // "PM" (Web Mercator) n'est PAS directement adressable en XYZ naïf (le TMS
    // équivalent utilise une origine bas-gauche, ce qui inverserait l'axe Y) :
    // le frontend doit construire un vrai ol/source/WMTS à partir de `config`.
    name: 'France Topo',
    slug: 'france-topo',
    type: BaseMapType.WMTS,
    url: 'https://data.geopf.fr/wmts',
    attribution: '© IGN-F/Géoportail',
    isDefault: false,
    order: 2,
    config: {
      layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
      // Vérifié dans le GetCapabilities réel (data.geopf.fr/wmts) : ce flux est lié au
      // TileMatrixSet "PM_0_19" (zooms 0-19), pas un simple "PM" générique - c'est la
      // cause du fond de carte qui ne s'affichait pas (toutes les requêtes de tuile
      // échouaient, le WMTS server ne reconnaissant pas de matrix set nommé "PM").
      matrixSet: 'PM_0_19',
      format: 'image/png',
      style: 'normal',
    },
  },
  {
    name: 'Mapbox Streets',
    slug: 'mapbox-streets',
    type: BaseMapType.XYZ,
    url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${config.MAPBOX_ACCESS_TOKEN}`,
    attribution: '© Mapbox © OpenStreetMap contributors',
    isDefault: false,
    order: 3,
  },
];
