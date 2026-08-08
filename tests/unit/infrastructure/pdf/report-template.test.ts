import { describe, it, expect } from 'vitest';
import { buildReportHtml, resolveZoneBbox } from '../../../../src/infrastructure/pdf/report-template.js';
import type { ZoneBasemapResult } from '../../../../src/infrastructure/pdf/zone-basemap.service.js';

describe('buildReportHtml', () => {
  it('should embed topic, instance name, narrative paragraphs and layer cards', () => {
    const html = buildReportHtml({
      topic: 'Densité de population à Douala 3',
      instanceName: 'Cameroun',
      generatedAt: new Date('2026-08-06T10:00:00Z'),
      narrative: 'Premier paragraphe.\n\nDeuxième paragraphe.',
      perLayer: [
        { layerId: 'l1', name: 'Hôpitaux', kind: 'vector', featureCount: 3, totalAreaKm2: null, totalLengthKm: null },
        {
          layerId: 'l2',
          name: 'Population',
          kind: 'raster',
          raster: { min: 0, max: 400, mean: 12.5, sum: 160159, count: 1000 },
        },
      ],
    });

    expect(html).toContain('Densité de population à Douala 3');
    expect(html).toContain('Cameroun');
    expect(html).toContain('<p>Premier paragraphe.</p>');
    expect(html).toContain('<p>Deuxième paragraphe.</p>');
    expect(html).toContain('Hôpitaux');
    expect(html).toContain('Population');
    expect(html).toContain((160159).toLocaleString('fr-FR'));
  });

  it('should escape HTML-sensitive characters in the topic', () => {
    const html = buildReportHtml({
      topic: '<script>alert(1)</script>',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 1, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should omit the zone/distribution sections when neither extent, geometry nor vector layers are given', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      perLayer: [
        { layerId: 'l1', name: 'Population', kind: 'raster', raster: { min: 0, max: 1, mean: 0.5, sum: null, count: 10 } },
      ],
    });

    expect(html).not.toContain('Zone analysée');
    expect(html).not.toContain('Répartition des données');
  });

  it('should render a zone map from the extent bbox when no drawn geometry is given', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('Zone analysée');
    expect(html).toContain('<rect');
    expect(html).toContain('4.0000, 9.6000');
    expect(html).toContain('4.1000, 9.8000');
  });

  it('should render the drawn zone polygon in preference to the extent when both are given', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [0, 0, 100, 100],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9.6, 4.0],
            [9.8, 4.0],
            [9.8, 4.1],
            [9.6, 4.1],
            [9.6, 4.0],
          ],
        ],
      },
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('<polygon');
    // Un seul <rect> attendu : le fond du carton (le bbox [0,0,100,100] ne doit PAS être dessiné
    // comme forme, seule la géométrie dessinée à la main doit apparaître).
    expect(html.match(/<rect /g)).toHaveLength(1);
    expect(html).toContain('4.0000, 9.6000');
  });

  it('should render a distribution chart with percentages across vector layers, excluding raster ones', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      perLayer: [
        { layerId: 'l1', name: 'Écoles', kind: 'vector', featureCount: 30, totalAreaKm2: null, totalLengthKm: null },
        { layerId: 'l2', name: 'Hôpitaux', kind: 'vector', featureCount: 10, totalAreaKm2: null, totalLengthKm: null },
        {
          layerId: 'l3',
          name: 'Population',
          kind: 'raster',
          raster: { min: 0, max: 1, mean: 0.5, sum: null, count: 10 },
        },
      ],
    });

    expect(html).toContain('Répartition des données');
    expect(html).toContain('Écoles');
    expect(html).toContain('75.0%');
    expect(html).toContain('Hôpitaux');
    expect(html).toContain('25.0%');
    expect(html).toContain('1 couche raster non incluse');
  });

  it('should display the geocoded place name above the zone map when given', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      placeName: 'Douala 3, Littoral, Cameroun',
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('Douala 3, Littoral, Cameroun');
  });

  it('should not render a place name block when geocoding failed (placeName omitted)', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).not.toContain('<div class="zone-place">');
  });

  it('should render a WMS basemap image behind the zone with attribution, aligned to the same bbox projection', () => {
    const wmsBasemap: ZoneBasemapResult = {
      kind: 'wms',
      widthPx: 480,
      heightPx: 296,
      dataUrl: 'data:image/png;base64,AAAA',
    };
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      basemap: wmsBasemap,
      basemapAttribution: '© SOGEFI',
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('© SOGEFI');
    // Pas de contour schématique de secours quand un vrai fond de carte est disponible.
    expect(html).not.toContain('fill="#f6f8f9" stroke="#e0e0e0"');
  });

  it('should render an XYZ tile mosaic behind the zone with OpenStreetMap attribution', () => {
    const xyzBasemap: ZoneBasemapResult = {
      kind: 'xyz',
      widthPx: 480,
      heightPx: 300,
      zoom: 12,
      topLeftPx: { x: 1000, y: 2000 },
      originOffsetX: 40,
      originOffsetY: 80,
      tiles: [
        { col: 0, row: 0, dataUrl: 'data:image/png;base64,TILE00' },
        { col: 1, row: 0, dataUrl: 'data:image/png;base64,TILE10' },
      ],
    };
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      basemap: xyzBasemap,
      basemapAttribution: '© OpenStreetMap contributors',
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('data:image/png;base64,TILE00');
    expect(html).toContain('data:image/png;base64,TILE10');
    expect(html).toContain('© OpenStreetMap contributors');
    expect(html).not.toContain('fill="#f6f8f9" stroke="#e0e0e0"');
  });

  it('should fall back to the schematic outline when basemap fetch failed (basemap null)', () => {
    const html = buildReportHtml({
      topic: 'Sujet',
      instanceName: 'Cameroun',
      generatedAt: new Date(),
      narrative: 'Texte.',
      extent: [9.6, 4.0, 9.8, 4.1],
      basemap: null,
      basemapAttribution: null,
      perLayer: [{ layerId: 'l1', name: 'X', kind: 'vector', featureCount: 5, totalAreaKm2: null, totalLengthKm: null }],
    });

    expect(html).toContain('fill="#f6f8f9" stroke="#e0e0e0"');
    expect(html).not.toContain('<div class="zone-attribution">');
  });
});

describe('resolveZoneBbox', () => {
  it('should return null when neither extent nor geometry is given', () => {
    expect(resolveZoneBbox()).toBeNull();
  });

  it('should return the extent verbatim when no geometry is given', () => {
    expect(resolveZoneBbox([9.6, 4.0, 9.8, 4.1])).toEqual([9.6, 4.0, 9.8, 4.1]);
  });

  it('should derive the bbox from a drawn polygon, preferring it over the extent', () => {
    const bbox = resolveZoneBbox([0, 0, 100, 100], {
      type: 'Polygon',
      coordinates: [
        [
          [9.6, 4.0],
          [9.8, 4.0],
          [9.8, 4.1],
          [9.6, 4.1],
          [9.6, 4.0],
        ],
      ],
    });

    expect(bbox).toEqual([9.6, 4.0, 9.8, 4.1]);
  });
});
