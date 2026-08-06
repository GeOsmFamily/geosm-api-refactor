import type { LayerSummaryEntry } from '../../application/use-cases/geoportail/summarize-viewport.use-case.js';

export interface ReportTemplateData {
  topic: string;
  instanceName: string;
  generatedAt: Date;
  perLayer: LayerSummaryEntry[];
  /** Texte multi-paragraphes (généré par Gemini, voir analysis-report.worker.ts) - un saut de
   * ligne double sépare les paragraphes, convertis en <p> ci-dessous. Pas de Markdown/HTML dans
   * le texte lui-même (échappé) pour éviter qu'une sortie IA imprévue casse la mise en page. */
  narrative: string;
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
  return n == null ? 'n/d' : n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatLayerCard(l: LayerSummaryEntry): string {
  if (l.kind === 'raster' && l.raster) {
    const rows = [
      ['Minimum', formatDecimal(l.raster.min)],
      ['Maximum', formatDecimal(l.raster.max)],
      ['Moyenne', formatDecimal(l.raster.mean)],
    ];
    if (l.raster.sum != null) rows.push(['Total estimé', Math.round(l.raster.sum).toLocaleString('fr-FR')]);
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
