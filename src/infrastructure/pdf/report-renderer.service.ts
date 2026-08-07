import puppeteer from 'puppeteer-core';
import { logger } from '../observability/logger.js';

/**
 * Rend un document HTML en PDF via Chromium headless (puppeteer-core, pointé sur le binaire
 * "chromium" installé par apt dans l'image Docker - voir Dockerfile/PUPPETEER_EXECUTABLE_PATH).
 * Utilisé pour les rapports d'analyse IA (voir plan "refonte Statistiques" du 2026-08-05) - les
 * plans de localisation, eux, restent générés via PyQGIS (QGISProjectService), mieux adapté à
 * une mise en page cartographique qu'à un document éditorial texte + graphiques.
 */
export class ReportRendererService {
  private readonly executablePath: string;

  constructor() {
    this.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
  }

  async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath: this.executablePath,
      headless: true,
      // --no-sandbox : requis pour lancer Chromium en tant qu'utilisateur non-root dans un
      // conteneur Docker (voir Dockerfile, l'API tourne sous "appuser") - le sandbox Chromium
      // dépend de primitives du noyau (user namespaces) souvent restreintes en conteneur.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      // HOME=/nonexistent pour "appuser" (utilisateur système, voir Dockerfile
      // "adduser --system") - le crash handler de Chromium (chrome_crashpad_handler) tente d'y
      // créer sa base de données de crashs et échoue immédiatement ("--database is required"),
      // empêchant même le lancement du navigateur. Confirmé en conditions réelles (`echo $HOME`
      // dans le conteneur -> /nonexistent, répertoire inexistant). /data est déjà accessible en
      // écriture à appuser (voir chown en fin de Dockerfile) - inutile de créer un nouveau
      // répertoire dédié pour ça.
      env: { ...process.env, HOME: '/data' },
    });

    try {
      const page = await browser.newPage();
      // Le HTML des rapports est entièrement autonome (CSS inline, aucune ressource externe) -
      // 'load' suffit, pas besoin d'attendre une inactivité réseau qui n'arrivera jamais si une
      // requête externe traîne.
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdf);
    } catch (error) {
      logger.error('Échec du rendu PDF (Puppeteer)', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await browser.close();
    }
  }
}
