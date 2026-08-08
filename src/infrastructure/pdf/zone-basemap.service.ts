import { logger } from '../observability/logger.js';

const TILE_SIZE = 256;
const MAX_ZOOM = 19;

export interface XyzTile {
  col: number;
  row: number;
  dataUrl: string;
}

export type ZoneBasemapResult =
  | {
      kind: 'xyz';
      widthPx: number;
      heightPx: number;
      zoom: number;
      /** Pixel global (repère Web Mercator, voir lonLatToPixel) du coin supérieur-gauche de la
       * fenêtre visible - permet à report-template.ts de projeter n'importe quel point [lon,lat]
       * dans le même repère que les tuiles via `lonLatToPixel(lon, lat, zoom) - topLeftPx`. */
      topLeftPx: { x: number; y: number };
      /** Décalage (px) du coin supérieur-gauche de la fenêtre visible à l'intérieur de la grille
       * de tuiles assemblée (dont l'origine est calée sur un bord de tuile, donc généralement
       * différente de la fenêtre visible) - sert uniquement à positionner le conteneur CSS de la
       * grille via un `left`/`top` négatif. */
      originOffsetX: number;
      originOffsetY: number;
      tiles: XyzTile[];
    }
  | {
      kind: 'wms';
      /** Dimensions réelles de l'image renvoyée par le serveur WMS - PAS forcément les
       * dimensions cible demandées : ajustées pour préserver le rapport d'aspect réel de la
       * bbox (voir fitBoxDimensions), sans quoi l'image serait étirée est-ouest ou nord-sud. */
      widthPx: number;
      heightPx: number;
      dataUrl: string;
    };

export function lonLatToPixel(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * Dimensions (px) d'une image couvrant [minLon,minLat,maxLon,maxLat] qui tient dans une fenêtre
 * `maxWidthPx`x`maxHeightPx` SANS déformer la forme réelle de la zone - correction cos(latitude)
 * sur l'échelle longitude (1° de longitude couvre une distance au sol qui diminue en s'éloignant
 * de l'équateur), même principe qu'un petit carton de localisation imprimé. Réutilisé à la fois
 * pour dimensionner une requête WMS GetMap (le serveur ne fait AUCUNE correction lui-même : il
 * étire linéairement BBOX sur WIDTH/HEIGHT tels quels) et pour le contour schématique de secours
 * (voir buildZoneMapHtml dans report-template.ts) - une seule formule de projection pour les deux
 * chemins garantit que le contour dessiné par-dessus l'image reste toujours parfaitement aligné.
 */
export function fitBoxDimensions(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
  maxWidthPx: number,
  maxHeightPx: number,
): { width: number; height: number; lonScale: number; scale: number } {
  const centerLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const lonScale = Math.max(Math.cos(centerLatRad), 0.15);
  const lonSpan = Math.max((maxLon - minLon) * lonScale, 1e-9);
  const latSpan = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min(maxWidthPx / lonSpan, maxHeightPx / latSpan);
  return { width: lonSpan * scale, height: latSpan * scale, lonScale, scale };
}

/** Plus grand zoom entier (0-19) pour lequel la bbox tient dans la fenêtre cible - même principe
 * qu'un "fitBounds" de bibliothèque cartographique client, réimplémenté ici côté serveur (pas de
 * bibliothèque cartographique disponible dans ce contexte Node, voir recherche préalable). */
function fitZoom(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
  targetWidthPx: number,
  targetHeightPx: number,
): number {
  for (let zoom = MAX_ZOOM; zoom > 0; zoom--) {
    const p1 = lonLatToPixel(minLon, maxLat, zoom);
    const p2 = lonLatToPixel(maxLon, minLat, zoom);
    if (Math.abs(p2.x - p1.x) <= targetWidthPx && Math.abs(p2.y - p1.y) <= targetHeightPx) {
      return zoom;
    }
  }
  return 0;
}

function buildTileUrl(template: string, z: number, x: number, y: number): string {
  return template
    .replace('{s}', 'a')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

async function toDataUrl(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

export interface BasemapSource {
  type: string;
  url: string;
  attribution?: string | null;
  config?: Record<string, unknown> | null;
}

/**
 * Récupère un fond de carte réel pour la zone d'un rapport d'analyse (voir analysis-report.worker.ts)
 * - permet au lecteur de reconnaître concrètement le secteur étudié plutôt qu'un simple contour
 * géométrique sur fond vide. Deux stratégies selon le type de fond de carte configuré côté admin
 * (voir BaseMap.type) :
 *   - XYZ : mosaïque de tuiles slippy-map (Web Mercator) autour de la bbox, assemblées et rognées
 *     côté client PDF (Puppeteer/Chromium) via CSS plutôt que par composition d'image côté Node -
 *     aucune bibliothèque d'images (sharp/canvas) n'est installée dans ce projet.
 *   - WMS : une seule requête GetMap dimensionnée exactement sur la bbox (EPSG:4326), pas de
 *     tuilage nécessaire.
 * WMTS/MAPBOX ne sont pas supportés ici (retourne `null`, le rapport retombe sur le contour
 * schématique existant) - jamais bloquant, comme le reste du pipeline de rapport (voir Gemini).
 */
export class ZoneBasemapService {
  async fetchForZone(
    bbox: [number, number, number, number],
    basemap: BasemapSource,
    targetWidthPx = 480,
    targetHeightPx = 300,
  ): Promise<ZoneBasemapResult | null> {
    try {
      if (basemap.type === 'XYZ') {
        return await this.fetchXyzMosaic(bbox, basemap.url, targetWidthPx, targetHeightPx);
      }
      if (basemap.type === 'WMS') {
        return await this.fetchWmsImage(bbox, basemap, targetWidthPx, targetHeightPx);
      }
      logger.debug('Fond de carte non supporté pour le rapport (type non géré)', {
        type: basemap.type,
      });
      return null;
    } catch (error) {
      logger.warn('Fond de carte indisponible pour le rapport, repli sur le contour schématique', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchXyzMosaic(
    [minLon, minLat, maxLon, maxLat]: [number, number, number, number],
    urlTemplate: string,
    targetWidthPx: number,
    targetHeightPx: number,
  ): Promise<ZoneBasemapResult> {
    const zoom = fitZoom(minLon, minLat, maxLon, maxLat, targetWidthPx, targetHeightPx);
    const topLeft = lonLatToPixel(minLon, maxLat, zoom);
    const bottomRight = lonLatToPixel(maxLon, minLat, zoom);

    const tileXMin = Math.floor(topLeft.x / TILE_SIZE);
    const tileXMax = Math.floor(bottomRight.x / TILE_SIZE);
    const tileYMin = Math.floor(topLeft.y / TILE_SIZE);
    const tileYMax = Math.floor(bottomRight.y / TILE_SIZE);
    const maxTileIndex = 2 ** zoom - 1;

    const requests: Promise<XyzTile>[] = [];
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      for (let tx = tileXMin; tx <= tileXMax; tx++) {
        const wrappedX = ((tx % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
        const url = buildTileUrl(urlTemplate, zoom, wrappedX, ty);
        requests.push(
          fetch(url, { headers: { 'User-Agent': 'GeOsm-API/1.0' } }).then(async (res) => {
            if (!res.ok) throw new Error(`Tuile ${zoom}/${wrappedX}/${ty} : ${res.status}`);
            return { col: tx - tileXMin, row: ty - tileYMin, dataUrl: await toDataUrl(res) };
          }),
        );
      }
    }
    const tiles = await Promise.all(requests);

    return {
      kind: 'xyz',
      widthPx: targetWidthPx,
      heightPx: targetHeightPx,
      zoom,
      topLeftPx: topLeft,
      originOffsetX: topLeft.x - tileXMin * TILE_SIZE,
      originOffsetY: topLeft.y - tileYMin * TILE_SIZE,
      tiles,
    };
  }

  private async fetchWmsImage(
    [minLon, minLat, maxLon, maxLat]: [number, number, number, number],
    basemap: BasemapSource,
    targetWidthPx: number,
    targetHeightPx: number,
  ): Promise<ZoneBasemapResult> {
    const { width, height } = fitBoxDimensions(
      minLon,
      minLat,
      maxLon,
      maxLat,
      targetWidthPx,
      targetHeightPx,
    );
    const roundedWidth = Math.max(1, Math.round(width));
    const roundedHeight = Math.max(1, Math.round(height));
    const layers = (basemap.config?.['layers'] as string) || '';
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetMap',
      LAYERS: layers,
      SRS: 'EPSG:4326',
      BBOX: `${minLon},${minLat},${maxLon},${maxLat}`,
      WIDTH: String(roundedWidth),
      HEIGHT: String(roundedHeight),
      FORMAT: 'image/png',
    });
    const separator = basemap.url.includes('?') ? '&' : '?';
    const response = await fetch(`${basemap.url}${separator}${params}`, {
      headers: { 'User-Agent': 'GeOsm-API/1.0' },
    });
    if (!response.ok) throw new Error(`Requête WMS GetMap échouée : ${response.status}`);

    return {
      kind: 'wms',
      widthPx: roundedWidth,
      heightPx: roundedHeight,
      dataUrl: await toDataUrl(response),
    };
  }
}
