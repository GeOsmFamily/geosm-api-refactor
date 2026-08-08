import type { LayerSummaryEntry } from '../../application/use-cases/geoportail/summarize-viewport.use-case.js';
import { fitBoxDimensions, lonLatToPixel, type ZoneBasemapResult } from './zone-basemap.service.js';

export interface ReportTemplateData {
  topic: string;
  instanceName: string;
  generatedAt: Date;
  perLayer: LayerSummaryEntry[];
  /** Texte multi-paragraphes (généré par Gemini, voir analysis-report.worker.ts) - un saut de
   * ligne double sépare les paragraphes, convertis en <p> ci-dessous. Pas de Markdown/HTML dans
   * le texte lui-même (échappé) pour éviter qu'une sortie IA imprévue casse la mise en page. */
  narrative: string;
  /** Emprise carte au moment de la demande (fallback quand aucune zone n'a été dessinée à la
   * main) - voir GenerateAnalysisReportUseCase/analysis-report.worker.ts. */
  extent?: [number, number, number, number];
  /** Zone dessinée à la main (prioritaire sur `extent`, voir startDrawZoneForMultiLayer côté
   * frontend) - un Polygon/MultiPolygon GeoJSON en EPSG:4326. */
  geometry?: Record<string, unknown>;
  /** Libellé lisible de la zone (ex: "Douala 3, Littoral, Cameroun"), déjà résolu par
   * ReverseGeocodingUseCase côté worker (géocodage jamais fait dans ce module, resté pur/testable
   * sans réseau) - `null`/absent si le géocodage a échoué ou n'a pas été tenté. */
  placeName?: string | null;
  /** Fond de carte déjà récupéré côté worker (voir ZoneBasemapService) - ce module reste pur
   * (aucun fetch ici, testable avec des données déjà en mémoire) ; `null`/absent si aucun fond de
   * carte n'a pu être récupéré, auquel cas un contour schématique de secours est utilisé. */
  basemap?: ZoneBasemapResult | null;
  /** Attribution du fond de carte utilisé (BaseMap.attribution, ex: "© OpenStreetMap
   * contributors") - affichée uniquement quand un vrai fond de carte (pas le contour schématique
   * de secours) a pu être inséré, condition requise par la licence ODbL des tuiles OSM. */
  basemapAttribution?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// fr-FR avec une décimale fixe partout (min/max/moyenne) - toLocaleString() seul donnait un
// nombre de décimales incohérent d'une ligne à l'autre (ex: "417,481" pour le max contre "11.9"
// pour la moyenne, qui passait par toFixed() - un point, pas une virgule) : la même fonction
// pour les trois évite ce mélange de séparateurs décimaux dans le même tableau.
function formatDecimal(n: number | null | undefined): string {
  return n == null
    ? 'n/d'
    : n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatLayerCard(l: LayerSummaryEntry): string {
  if (l.kind === 'raster' && l.raster) {
    const rows = [
      ['Minimum', formatDecimal(l.raster.min)],
      ['Maximum', formatDecimal(l.raster.max)],
      ['Moyenne', formatDecimal(l.raster.mean)],
    ];
    if (l.raster.sum != null)
      rows.push(['Total estimé', Math.round(l.raster.sum).toLocaleString('fr-FR')]);
    return `
      <div class="layer-card">
        <h3>${escapeHtml(l.name)} <span class="badge">raster</span></h3>
        <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
      </div>`;
  }
  const rows = [['Entités', String(l.featureCount ?? 0)]];
  if (l.totalAreaKm2 != null) rows.push(['Surface totale', `${l.totalAreaKm2.toFixed(2)} km²`]);
  if (l.totalLengthKm != null) rows.push(['Longueur totale', `${l.totalLengthKm.toFixed(2)} km`]);
  return `
    <div class="layer-card">
      <h3>${escapeHtml(l.name)} <span class="badge">vecteur</span></h3>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    </div>`;
}

/** Extrait les anneaux extérieurs [lon,lat] d'un Polygon/MultiPolygon GeoJSON - ignore les trous
 * (les rapports montrent un simple repère de localisation, pas une carte topographique précise,
 * donc pas besoin de rendre les anneaux intérieurs). */
function extractOuterRings(geometry: Record<string, unknown>): [number, number][][] {
  const type = geometry['type'];
  const coordinates = geometry['coordinates'] as unknown;
  if (type === 'Polygon') {
    const rings = coordinates as [number, number][][];
    return rings.length > 0 ? [rings[0]] : [];
  }
  if (type === 'MultiPolygon') {
    const polygons = coordinates as [number, number][][][];
    return polygons.map((rings) => rings[0]).filter((ring): ring is [number, number][] => !!ring);
  }
  return [];
}

function bboxFromRings(rings: [number, number][][]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Exporté pour analysis-report.worker.ts : la même résolution bbox (géométrie dessinée
 * prioritaire sur l'emprise carte) que celle utilisée pour dessiner la section "Zone analysée",
 * réutilisée pour choisir le centre à géocoder et la zone à demander à ZoneBasemapService - une
 * seule définition de "la zone du rapport" pour tout le pipeline. */
export function resolveZoneBbox(
  extent?: [number, number, number, number],
  geometry?: Record<string, unknown>,
): [number, number, number, number] | null {
  if (!extent && !geometry) return null;
  const rings = geometry ? extractOuterRings(geometry) : [];
  const bbox = rings.length > 0 ? bboxFromRings(rings) : extent!;
  return Number.isFinite(bbox[0]) && Number.isFinite(bbox[1]) ? bbox : null;
}

// Doit rester égal aux dimensions cible par défaut passées à ZoneBasemapService.fetchForZone()
// côté worker (voir analysis-report.worker.ts) : le fond de carte XYZ est toujours livré à
// exactement ces dimensions (pas de letterboxing), donc un écart romprait l'alignement du
// contour de zone par-dessus la mosaïque de tuiles.
const BOX_W = 480;
const BOX_H = 300;

/** Contour schématique de secours (pas de fond de carte disponible - échec réseau, fond de carte
 * non supporté, aucun fond de carte configuré sur l'instance...) : un simple polygone sur fond
 * neutre, toujours mieux que rien plutôt que de faire échouer tout le rapport (voir ZoneBasemapService,
 * jamais bloquant). Correction cos(latitude) sur l'échelle X pour éviter une déformation grossière
 * est-ouest, même approximation que pour un petit carton de localisation imprimé. */
function buildSchematicZoneSvg(
  rings: [number, number][][],
  [minLon, minLat, maxLon, maxLat]: [number, number, number, number],
): string {
  const { width, height, lonScale, scale } = fitBoxDimensions(
    minLon,
    minLat,
    maxLon,
    maxLat,
    BOX_W,
    BOX_H,
  );
  const offsetX = (BOX_W - width) / 2;
  const offsetY = (BOX_H - height) / 2;

  const project = ([lon, lat]: [number, number]): [number, number] => [
    offsetX + (lon - minLon) * lonScale * scale,
    offsetY + (maxLat - lat) * scale,
  ];

  const shapeSvg =
    rings.length > 0
      ? rings
          .map((ring) => {
            const points = ring.map((pt) => project(pt).join(',')).join(' ');
            return `<polygon points="${points}" fill="rgba(0,173,167,0.18)" stroke="#023f5f" stroke-width="1.5" />`;
          })
          .join('')
      : (() => {
          const [x1, y1] = project([minLon, maxLat]);
          const [x2, y2] = project([maxLon, minLat]);
          return `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="rgba(0,173,167,0.18)" stroke="#023f5f" stroke-width="1.5" />`;
        })();

  return `
      <svg viewBox="0 0 ${BOX_W} ${BOX_H}" width="100%" height="${BOX_H}">
        <rect x="0" y="0" width="${BOX_W}" height="${BOX_H}" fill="#f6f8f9" stroke="#e0e0e0" />
        ${shapeSvg}
      </svg>`;
}

/** Fond de carte réel (WMS : une seule image déjà cadrée sur la bbox) - projection identique à
 * fitBoxDimensions pour garantir que le contour de la zone reste exactement aligné sur l'image. */
function buildWmsZoneMap(
  rings: [number, number][][],
  [minLon, minLat, maxLon, maxLat]: [number, number, number, number],
  basemap: Extract<ZoneBasemapResult, { kind: 'wms' }>,
): string {
  const offsetX = (BOX_W - basemap.widthPx) / 2;
  const offsetY = (BOX_H - basemap.heightPx) / 2;
  const project = ([lon, lat]: [number, number]): [number, number] => [
    offsetX + ((lon - minLon) / Math.max(maxLon - minLon, 1e-9)) * basemap.widthPx,
    offsetY + ((maxLat - lat) / Math.max(maxLat - minLat, 1e-9)) * basemap.heightPx,
  ];
  const polygonsSvg = rings
    .map((ring) => {
      const points = ring.map((pt) => project(pt).join(',')).join(' ');
      return `<polygon points="${points}" fill="rgba(0,173,167,0.18)" stroke="#023f5f" stroke-width="1.5" />`;
    })
    .join('');

  return `
      <div style="position:relative;width:${BOX_W}px;height:${BOX_H}px;overflow:hidden;background:#f6f8f9;">
        <img src="${basemap.dataUrl}" style="position:absolute;left:${offsetX}px;top:${offsetY}px;width:${basemap.widthPx}px;height:${basemap.heightPx}px;" />
        <svg viewBox="0 0 ${BOX_W} ${BOX_H}" width="${BOX_W}" height="${BOX_H}" style="position:absolute;left:0;top:0;">
          ${polygonsSvg}
        </svg>
      </div>`;
}

/** Fond de carte réel (XYZ : mosaïque de tuiles Web Mercator) - la grille de tuiles est plus
 * grande que la fenêtre visible (calée sur les bords de tuile) et positionnée en négatif pour
 * que la zone demandée apparaisse pile dans la fenêtre ; le contour est projeté dans le MÊME
 * repère pixel global (voir lonLatToPixel) puis recalé sur `topLeftPx`, donc toujours aligné. */
function buildXyzZoneMap(
  rings: [number, number][][],
  basemap: Extract<ZoneBasemapResult, { kind: 'xyz' }>,
): string {
  const tileGridLeft = -basemap.originOffsetX;
  const tileGridTop = -basemap.originOffsetY;
  const tilesHtml = basemap.tiles
    .map(
      (t) =>
        `<img src="${t.dataUrl}" style="position:absolute;left:${t.col * 256}px;top:${t.row * 256}px;width:256px;height:256px;" />`,
    )
    .join('');

  const project = ([lon, lat]: [number, number]): [number, number] => {
    const p = lonLatToPixel(lon, lat, basemap.zoom);
    return [p.x - basemap.topLeftPx.x, p.y - basemap.topLeftPx.y];
  };
  const polygonsSvg = rings
    .map((ring) => {
      const points = ring.map((pt) => project(pt).join(',')).join(' ');
      return `<polygon points="${points}" fill="rgba(0,173,167,0.18)" stroke="#023f5f" stroke-width="1.5" />`;
    })
    .join('');

  return `
      <div style="position:relative;width:${basemap.widthPx}px;height:${basemap.heightPx}px;overflow:hidden;background:#f6f8f9;">
        <div style="position:absolute;left:${tileGridLeft}px;top:${tileGridTop}px;">${tilesHtml}</div>
        <svg viewBox="0 0 ${basemap.widthPx} ${basemap.heightPx}" width="${basemap.widthPx}" height="${basemap.heightPx}" style="position:absolute;left:0;top:0;">
          ${polygonsSvg}
        </svg>
      </div>`;
}

/** Section "Zone analysée" du rapport : nom de lieu (géocodage inverse, voir placeName) + fond de
 * carte réel quand disponible (voir ZoneBasemapService/analysis-report.worker.ts), avec repli sur
 * un contour schématique si aucun fond de carte n'a pu être récupéré - jamais bloquant. */
function buildZoneMapHtml(
  extent: [number, number, number, number] | undefined,
  geometry: Record<string, unknown> | undefined,
  basemap: ZoneBasemapResult | null | undefined,
  placeName: string | null | undefined,
  basemapAttribution: string | null | undefined,
): string | null {
  if (!extent && !geometry) return null;

  const rings = geometry ? extractOuterRings(geometry) : [];
  const bbox = rings.length > 0 ? bboxFromRings(rings) : extent!;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;

  let mapHtml: string;
  if (basemap?.kind === 'wms') {
    mapHtml = buildWmsZoneMap(rings, bbox, basemap);
  } else if (basemap?.kind === 'xyz') {
    mapHtml = buildXyzZoneMap(rings, basemap);
  } else {
    mapHtml = buildSchematicZoneSvg(rings, bbox);
  }

  const placeNameHtml = placeName ? `<div class="zone-place">${escapeHtml(placeName)}</div>` : '';
  const attributionHtml =
    basemap && basemapAttribution
      ? `<div class="zone-attribution">${escapeHtml(basemapAttribution)}</div>`
      : '';

  return `
    <div class="zone-map">
      ${placeNameHtml}
      ${mapHtml}
      ${attributionHtml}
      <div class="zone-coords">
        <span>${minLat.toFixed(4)}, ${minLon.toFixed(4)}</span>
        <span>${maxLat.toFixed(4)}, ${maxLon.toFixed(4)}</span>
      </div>
    </div>`;
}

/** Répartition du volume de données par couche vectorielle (part de chaque couche dans le total
 * d'entités analysées) - les couches raster sont listées à part (comptage de cellules, pas
 * d'"entités" comparables) plutôt que d'être forcées dans le même pourcentage. */
function buildDistributionChart(perLayer: LayerSummaryEntry[]): string | null {
  const vectorLayers = perLayer.filter((l) => l.kind === 'vector' && (l.featureCount ?? 0) > 0);
  if (vectorLayers.length === 0) return null;

  const total = vectorLayers.reduce((sum, l) => sum + (l.featureCount ?? 0), 0);
  const sorted = [...vectorLayers].sort((a, b) => (b.featureCount ?? 0) - (a.featureCount ?? 0));

  const rows = sorted
    .map((l) => {
      const pct = total > 0 ? ((l.featureCount ?? 0) / total) * 100 : 0;
      return `
        <div class="dist-row">
          <div class="dist-label">${escapeHtml(l.name)}</div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div class="dist-value">${l.featureCount ?? 0} <span>(${pct.toFixed(1)}%)</span></div>
        </div>`;
    })
    .join('');

  const rasterLayers = perLayer.filter((l) => l.kind === 'raster');
  const plural = rasterLayers.length > 1 ? 's' : '';
  const rasterNote =
    rasterLayers.length > 0
      ? `<p class="dist-note">${rasterLayers.length} couche${plural} raster non incluse${plural} ci-dessus (agrégats continus, pas d'entités dénombrables) : voir leurs statistiques dans "Données utilisées".</p>`
      : '';

  return `<div class="distribution">${rows}</div>${rasterNote}`;
}

/** Construit le document HTML complet d'un rapport d'analyse - voir ReportRendererService pour
 * la conversion en PDF. Charte visuelle alignée sur le géoportail (--primary/--accent, voir
 * environment.ts frontend), volontairement autonome (pas de dépendance CSS externe : le PDF
 * doit rester identique quel que soit l'environnement de rendu). */
export function buildReportHtml(data: ReportTemplateData): string {
  const dateStr = data.generatedAt.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const narrativeHtml = data.narrative
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');
  const zoneMapHtml = buildZoneMapHtml(
    data.extent,
    data.geometry,
    data.basemap,
    data.placeName,
    data.basemapAttribution,
  );
  const distributionHtml = buildDistributionChart(data.perLayer);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.topic)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  header {
    border-bottom: 3px solid #023f5f;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  header .brand { color: #00ada7; font-weight: 700; font-size: 13px; letter-spacing: 1px; }
  header h1 { color: #023f5f; font-size: 22px; margin: 6px 0; }
  header .meta { color: #666; font-size: 11px; }
  h2 { color: #023f5f; font-size: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  .narrative p { margin: 0 0 10px; text-align: justify; }
  .layers-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
  .layer-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 10px 14px;
    width: 47%;
    page-break-inside: avoid;
  }
  .layer-card h3 { margin: 0 0 6px; font-size: 12.5px; color: #023f5f; }
  .badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: #00ada7;
    background: rgba(0, 173, 167, 0.1);
    border-radius: 3px;
    padding: 1px 6px;
    margin-left: 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  table td { padding: 2px 0; font-size: 11.5px; }
  table td:first-child { color: #666; }
  table td:last-child { text-align: right; font-weight: 600; }
  .zone-map { margin-top: 12px; page-break-inside: avoid; }
  .zone-map svg { display: block; border-radius: 6px; }
  .zone-map > div { border-radius: 6px; }
  .zone-place { font-size: 13px; font-weight: 600; color: #023f5f; margin-bottom: 6px; }
  .zone-attribution { font-size: 8.5px; color: #aaa; text-align: right; margin-top: 2px; }
  .zone-coords {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: #999;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }
  .distribution { margin-top: 12px; page-break-inside: avoid; }
  .dist-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .dist-label { width: 30%; font-size: 11px; color: #333; }
  .dist-bar-track { flex: 1; height: 10px; background: #eef1f2; border-radius: 5px; overflow: hidden; }
  .dist-bar-fill { height: 100%; background: #00ada7; border-radius: 5px; }
  .dist-value { width: 22%; text-align: right; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .dist-value span { font-weight: 400; color: #999; }
  .dist-note { font-size: 10px; color: #999; margin: 6px 0 0; }
  footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd; color: #999; font-size: 9.5px; }
</style>
</head>
<body>
  <header>
    <div class="brand">GeOsm &middot; RAPPORT D'ANALYSE</div>
    <h1>${escapeHtml(data.topic)}</h1>
    <div class="meta">${escapeHtml(data.instanceName)} &middot; généré le ${dateStr} &middot; assistant IA</div>
  </header>

  <h2>Analyse</h2>
  <div class="narrative">${narrativeHtml}</div>

  ${zoneMapHtml ? `<h2>Zone analysée</h2>${zoneMapHtml}` : ''}

  ${distributionHtml ? `<h2>Répartition des données</h2>${distributionHtml}` : ''}

  <h2>Données utilisées</h2>
  <div class="layers-grid">
    ${data.perLayer.map(formatLayerCard).join('')}
  </div>

  <footer>
    Rapport généré automatiquement par l'assistant IA du géoportail GeOsm à partir des couches
    actives au moment de la demande. Les chiffres reflètent l'état des données à la date de
    génération et peuvent évoluer. Les repères de comparaison éventuellement cités sont
    indicatifs, pas des statistiques officielles vérifiées.
  </footer>
</body>
</html>`;
}
