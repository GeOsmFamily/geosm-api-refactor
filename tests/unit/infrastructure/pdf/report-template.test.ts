import { describe, it, expect } from 'vitest';
import { buildReportHtml } from '../../../../src/infrastructure/pdf/report-template.js';

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
});
