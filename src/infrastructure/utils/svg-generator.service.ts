import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface SvgOptions {
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'pin';
  size: number;
  strokeColor?: string;
  strokeWidth?: number;
  label?: string;
  /** Layer slug — preferred key to resolve the inner glyph (avoids label collisions). */
  iconKey?: string;
}

export class SvgGeneratorService {
  generateSvg(options: SvgOptions): string {
    const {
      color,
      shape,
      size,
      strokeColor = '#000000',
      strokeWidth = 1,
      label,
      iconKey,
    } = options;
    const half = size / 2;
    const pad = Math.max(4, Math.round(size * 0.12));

    let shapeElement: string;
    switch (shape) {
      case 'circle':
        shapeElement = `<circle cx="${half}" cy="${half}" r="${half - strokeWidth}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
      case 'square': {
        const r = Math.max(4, size * 0.18);
        shapeElement = `<rect x="${strokeWidth}" y="${strokeWidth}" width="${size - strokeWidth * 2}" height="${size - strokeWidth * 2}" rx="${r}" ry="${r}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
      }
      case 'triangle': {
        const points = `${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}`;
        shapeElement = `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
        break;
      }
      case 'star': {
        const outerR = half - strokeWidth;
        const innerR = outerR * 0.4;
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          pts.push(`${half + r * Math.cos(angle)},${half + r * Math.sin(angle)}`);
        }
        shapeElement = `<polygon points="${pts.join(' ')}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
        break;
      }
      case 'pin':
        shapeElement = `<path d="M${half} ${size - strokeWidth} C${half} ${size - strokeWidth} ${size - strokeWidth} ${half + 4} ${size - strokeWidth} ${half - 2} C${size - strokeWidth} ${strokeWidth + 4} ${half + 6} ${strokeWidth} ${half} ${strokeWidth} C${half - 6} ${strokeWidth} ${strokeWidth} ${strokeWidth + 4} ${strokeWidth} ${half - 2} C${strokeWidth} ${half + 4} ${half} ${size - strokeWidth} ${half} ${size - strokeWidth} Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
        break;
    }

    // Subtle top highlight for a soft "badge" look (two-tone, not flat).
    const highlightR = half - strokeWidth - 2;
    const highlightElement =
      highlightR > 4
        ? `<ellipse cx="${half}" cy="${half - highlightR * 0.45}" rx="${highlightR * 0.7}" ry="${highlightR * 0.35}" fill="#ffffff" opacity="0.16"/>`
        : '';

    let labelElement = '';
    const innerIcon = getInnerIconPath(iconKey, label);
    if (innerIcon) {
      // Tous les glyphes (CROSS, BANK, TREE...) sont dessinés avec des coordonnées absolues
      // supposant un canevas de 32x32 centré sur (16,16) - sans ce scale(size/32), un glyphe
      // reste figé à sa position/taille de conception dès que `size` s'écarte de 32, produisant
      // un décalage visible par rapport au centre réel de la forme (half,half). Le point de
      // conception (16,16) devient exactement (half,half) après ce scale, quelle que soit size.
      labelElement = `<g transform="scale(${size / 32})">${innerIcon}</g>`;
    } else if (label) {
      labelElement = `<text x="${half}" y="${half + 4}" text-anchor="middle" font-size="${Math.max(8, size / 3)}" fill="${strokeColor}" font-family="Arial">${label}</text>`;
    }

    const canvasSize = size + pad * 2;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">` +
      `<defs><filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.35"/>` +
      `</filter></defs>` +
      `<g transform="translate(${pad},${pad})" filter="url(#dropshadow)">${shapeElement}${highlightElement}${labelElement}</g>` +
      `</svg>`
    );
  }

  generateMultipleSvg(optionsList: SvgOptions[]): string[] {
    return optionsList.map((opts) => this.generateSvg(opts));
  }

  async saveSvgToFile(svg: string, outputPath: string): Promise<string> {
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(outputPath, svg, 'utf-8');
    return outputPath;
  }
}

// ─── Shared glyph fragments (reused across several layers of the same family) ──
const CROSS = `<path d="M9 14h14v4H9z M14 9h4v14h-4z" fill="#ffffff"/>`;
const GRAD_CAP = `<path d="M16 9l8 4-8 4-8-4z M10 15v3c0 1.5 2.7 2.5 6 2.5s6-1 6-2.5v-3 M21 13v4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const BANK = `<path d="M16 8l9 4H7z M8 12h16v1.5H8z M10 13.5v6.5h2v-6.5zm4 0v6.5h2v-6.5zm4 0v6.5h2v-6.5z M7 20h18v2.5H7z" fill="#ffffff"/>`;
const TREE = `<path d="M16 8l5 5h-3.5l4.5 5h-12l4.5-5H11z M14.5 18h3v5h-3z" fill="#ffffff"/>`;
const PLANE = `<path d="M16 8l1.5 5.5L23 15v1.5l-5.5-1L16 21l2 2v1h-4v-1l2-2-1.5-5.5-5.5 1V15l5.5-1.5L16 8z" fill="#ffffff"/>`;
const ANCHOR = `<path d="M16 9v9 M12 13h8 M10 15c0 3.3 2.7 6 6 6s6-2.7 6-6 M16 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
const TRAIN = `<path d="M10 9h12v9H10zm0 9l-2 2v1h16v-1l-2-2 M12 15h8" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
const BUS = `<path d="M9 9h14v9H9zm3 3h8v3h-8z M12 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
const CAR = `<path d="M8 14h16v4H8zm2-2.5l2.5-3.5h7l2.5 3.5z M10 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm12 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
const SHIELD = `<path d="M16 9c3.5 0 5.5-1 5.5-1s1.5 3 1.5 6.5c0 4-7 6.5-7 6.5s-7-2.5-7-6.5c0-3.5 1.5-6.5 1.5-6.5s3.5 1 5.5 1z" fill="#ffffff"/>`;
const SCALES = `<path d="M16 9v13M10 12h12M10 12l-2 5h4zM20 12l-2 5h4z M12 22h8" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
const GOV_BUILDING = `<path d="M9 9h14v12H9zm2 3h10 M12 17h8" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
const FORK_KNIFE = `<path d="M11 9v5 M10 9v3h2v-3 M12 9v3 M18 9v11 M18 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
const BED = `<path d="M8 10v12 M8 15h16 M24 10v12 M11 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
const TENT = `<path d="M16 8l10 12H6z M16 8v12" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;

// ─── New glyphs added to cover Commerce/Loisirs layers that previously fell back
// to the generic shopping-bag default. ──────────────────────────────────────────
const BOOK = `<path d="M16 11c-1.8-1.3-4-2-6.5-2v11c2.5 0 4.7.7 6.5 2 1.8-1.3 4-2 6.5-2V9c-2.5 0-4.7.7-6.5 2z M16 11v11" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const BASKET = `<path d="M9 15h14l-1.5 8h-11z M9 15l3-6h8l3 6 M13 19v2m3-2v2m3-2v2" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
const PAW = `<path d="M16 17c-2.5 0-4.5 2-4.5 4.2 0 1.4 1.1 2.3 2.5 2.3.9 0 1.3-.4 2-.4s1.1.4 2 .4c1.4 0 2.5-.9 2.5-2.3 0-2.2-2-4.2-4.5-4.2z M12 13a1.6 2 0 1 0 0 .01zm8 0a1.6 2 0 1 0 0 .01zM14.3 9.8a1.4 1.8 0 1 0 0 .01zm3.4 0a1.4 1.8 0 1 0 0 .01z" fill="#ffffff"/>`;
const SHOE = `<path d="M9 20c0-1.5 1-2.5 1-4l1-6h3l.5 3.5 6.5 2c1.5.5 3 1.3 3 2.5v2z M11 16h11" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const LEAF = `<path d="M22 10c-7 0-11 4-11 10 0 1.3.2 2.3.5 3 6-1 10.5-5.5 10.5-13z M11.5 23c3-3 6-6 10-11" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
const FERRIS_WHEEL = `<circle cx="16" cy="15" r="7" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M16 8v14M9 15h14M11 10l10 10M21 10l-10 10 M16 24v2M13 26h6" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const ANIMAL = `<path d="M16 12a5 5 0 0 0-5 5c0 3 2 6 5 6s5-3 5-6a5 5 0 0 0-5-5z M12 10a1.8 2.2 0 1 0 0 .01zm8 0a1.8 2.2 0 1 0 0 .01z" fill="#ffffff"/>`;
const WAVE = `<path d="M8 13c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0 M8 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0 M8 23c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
const BALL = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M16 10.5l3.5 2.5-1.3 4h-4.4l-1.3-4z M16 9v1.5M10 13.5l1.7.5M12.6 22.5l1-3.5M19.4 22.5l-1-3.5M22 13.5l-1.7.5" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const SWING = `<path d="M9 10v13 M23 10v13 M9 10h14 M13 15l1.5 8h3L19 15" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;

const DEFAULT_GLYPH = `<path d="M10 12h12v8H10zm3-3a3 3 0 0 1 6 0" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;

// ─── Glyphes génériques additionnels, pour le sélecteur d'icônes de l'assistant de création
// de couche (voir GetIconCatalogUseCase) : indépendants de tout slug de couche par défaut,
// pensés pour couvrir des cas non déjà représentés par les glyphes ci-dessus.
const PHARMACY = `<path d="M16 9v14M9 16h14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`;
const HOME = `<path d="M16 9l8 7h-2.5v8h-11v-8H8z M13 24v-5h6v5" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const SHOP = `<path d="M9 13l1.5-4h11l1.5 4z M9 13h14v10H9z M13 17v6M19 17v6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const FUEL = `<path d="M9 24V11h8v13z M9 24h9 M17 15h2l2 2v5a1 1 0 0 0 2 0v-6l-2-2" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const PARKING = `<path d="M11 9h10a4 4 0 0 1 0 8h-6v6h-4z M15 12h5a1.5 1.5 0 0 1 0 3h-5z" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const CAMERA = `<path d="M8 13h4l2-3h4l2 3h4v10H8z M16 15.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const MOUNTAIN = `<path d="M8 22l6-9 4 5 2-3 4 7z" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const WIFI = `<path d="M9 15a10 10 0 0 1 14 0 M11.5 18a6.5 6.5 0 0 1 9 0 M14 21a3 3 0 0 1 4 0 M16 24v.01" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
const FLAG = `<path d="M11 9v14 M11 10h10l-2.5 3.5L21 17H11" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const WATER_DROP = `<path d="M16 8c3 4.5 5 7.7 5 10.3a5 5 0 1 1-10 0C11 15.7 13 12.5 16 8z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
const MAIL = `<path d="M8 11h16v10H8z M8 11l8 6 8-6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const PHONE = `<path d="M11 9c1 0 2 2 2 3s-1 1.5-1 2.5c0 2 2.5 4.5 4.5 4.5 1 0 1.5-1 2.5-1s3 1 3 2c0 1.5-1.5 3-3 3-5 0-11-6-11-11 0-1.5 1.5-3 3-3z" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const CAMPFIRE = `<path d="M16 10c1 2-1 3-1 5a2 2 0 1 0 4 0c0-1-1-1.5-1-3 2 1.5 3 3.5 3 5.5a5 5 0 1 1-10 0c0-3 2-5.5 5-7.5z" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const MUSEUM = `<path d="M8 22h16 M9 22V14l7-5 7 5v8 M12 14v8m4-8v8m4-8v8" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const CROSS_SIMPLE = `<path d="M16 9v14M9 16h14" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>`;
const STAR_GLYPH = `<path d="M16 9l2.1 4.6 5 .6-3.7 3.5 1 5-4.4-2.5-4.4 2.5 1-5-3.7-3.5 5-.6z" fill="#ffffff"/>`;
const GEAR = `<path d="M16 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M16 9v2m0 10v2m7-7h-2M11 16H9m10.5-4.5-1.4 1.4m-8.2 8.2-1.4 1.4m0-11 1.4 1.4m8.2 8.2 1.4 1.4" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const RECYCLE = `<path d="M16 9l3 5h-6z M11 20l-2-3.5 5-3 M21 20l2-3.5-5-3 M13 20h6" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const SUITCASE = `<path d="M9 14h14v9H9z M13 14v-2h6v2" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const CLOCK = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M16 12v4l3 2" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;

// ─── Deuxième lot de glyphes génériques (catégories OSM courantes non encore couvertes). ──
const BICYCLE = `<circle cx="11" cy="20" r="3.2" stroke="#ffffff" stroke-width="1.4" fill="none"/><circle cx="21" cy="20" r="3.2" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M11 20l4-9h4l3 5m-7-5l3 5h6M15 11h3" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const MOTORCYCLE = `<circle cx="10" cy="21" r="2.8" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="22" cy="21" r="2.8" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M10 21l3-6h5l2 4h2l2-3M13 15h5" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const TAXI = `<path d="M8 21h16v-4l-2-5H10l-2 5z M13 12h6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/><circle cx="11.5" cy="21" r="1.4" fill="#ffffff"/><circle cx="20.5" cy="21" r="1.4" fill="#ffffff"/>`;
const BOAT = `<path d="M9 19h14l-2 5H11z M14 19V9h1l4 6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const WORSHIP = `<path d="M16 8v4m-2-2h4 M13 24V14h6v10 M10 24h12" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>`;
const FACTORY = `<path d="M8 24V14l4 3v-3l4 3v-3l4 3V9h4v15z M8 24h16" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const FARM = `<path d="M9 24V14l7-5 7 5v10 M9 24h14 M16 24v-6h2v6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const SCISSORS = `<circle cx="11" cy="10" r="2" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="11" cy="22" r="2" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M12.5 11.5L23 21M12.5 20.5L23 11" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const DUMBBELL = `<path d="M9 16h14 M9 13v6M12 11v10M20 11v10M23 13v6" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
const CINEMA = `<path d="M8 11h16v11H8z M8 11l3-3h2l-2 3zm5 0l3-3h2l-2 3zm5 0l3-3h2l-2 3z" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
const FIRE = `<path d="M16 9c1 2.5-1 3.5-1 6a3 3 0 1 0 6 0c0-1.2-1-2-1-3.5 2.5 2 3.5 4.5 3.5 6.5a5.5 5.5 0 1 1-11 0c0-4 2-6.5 3.5-9z" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const AMBULANCE = `<path d="M8 20V13h9v7z M17 15h5l2 3v2h-7z" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M12 14v4m-2-2h4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="22" r="1.3" fill="#ffffff"/><circle cx="21" cy="22" r="1.3" fill="#ffffff"/>`;
const WAREHOUSE = `<path d="M8 24V13l8-4 8 4v11z M8 24h16 M12 24v-6h8v6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const BRIDGE = `<path d="M8 20a8 6 0 0 1 16 0 M8 20h16 M11 20v3m10-3v3" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
const ANTENNA = `<path d="M16 10v14 M11 24l5-14 5 14 M13 16h6" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const SOLAR_PANEL = `<path d="M8 13l4-4h10l2 4z M8 13h16v8H8z M8 17h16M12 13v8m4-8v8m4-8v8" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
const WELL = `<circle cx="16" cy="17" r="6" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M16 9v2m0 12v2" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>`;
const BIN = `<path d="M10 13h12l-1 11H11z M9 13h14 M13 13v-2h6v2" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/>`;
const PICNIC = `<path d="M8 15h16l-3 9M24 15l-3 9M11 24l3-9M21 24l-3-9 M8 18h16" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const VIEWPOINT = `<circle cx="16" cy="14" r="4" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M8 24c0-4 3.5-6 8-6s8 2 8 6" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const CASTLE = `<path d="M9 24V13h3v-3h2v3h4v-3h2v3h3v11z M9 24h14" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const TOY_BLOCKS = `<rect x="8" y="10" width="7" height="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="17" y="10" width="7" height="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="12" y="19" width="8" height="5" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const VET = `<path d="M16 22c-3 0-5.5-2.2-5.5-5 0-3.4 2.7-6 5.5-6s5.5 2.6 5.5 6c0 2.8-2.5 5-5.5 5z M16 14v5m-2.5-2.5h5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const TOOTH = `<path d="M16 9c-3 0-5 2-5 5 0 2 .8 3 1.2 5.5.3 1.8.8 3.5 1.8 3.5s1-2 1-3.5.5-2 1-2 1 .5 1 2 .3 3.5 1 3.5 1.5-1.7 1.8-3.5C20.2 17 21 16 21 14c0-3-2-5-5-5z" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const MICROSCOPE = `<path d="M13 24h8 M17 24v-4a4 4 0 0 0-4-4h-1l-3-3 1-1 4 3" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/><circle cx="12" cy="11" r="1.5" fill="#ffffff"/>`;
const PRISON = `<path d="M9 10v14M13 10v14M17 10v14M21 10v14M9 10h12M9 24h12" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const CURRENCY_EXCHANGE = `<circle cx="13" cy="13" r="4.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="19" cy="19" r="4.5" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;

/**
 * Catalogue d'icônes génériques (indépendant de tout slug de couche par défaut) pour le
 * sélecteur d'icônes de l'assistant de création de couche - regroupe les glyphes déjà utilisés
 * par les couches par défaut (réutilisés tels quels) et de nouveaux glyphes couvrant des
 * catégories jusque-là non représentées.
 */
export const ICON_CATALOG: { key: string; label: string; category: string; svgPath: string }[] = [
  { key: 'cross', label: 'Croix médicale', category: 'sante', svgPath: CROSS },
  { key: 'cross-simple', label: 'Croix simple', category: 'sante', svgPath: CROSS_SIMPLE },
  { key: 'pharmacy', label: 'Pharmacie', category: 'sante', svgPath: PHARMACY },
  { key: 'graduation-cap', label: 'Éducation', category: 'education', svgPath: GRAD_CAP },
  { key: 'book', label: 'Livre', category: 'education', svgPath: BOOK },
  { key: 'bank', label: 'Banque', category: 'finance', svgPath: BANK },
  { key: 'tree', label: 'Arbre', category: 'environnement', svgPath: TREE },
  { key: 'leaf', label: 'Feuille', category: 'environnement', svgPath: LEAF },
  { key: 'recycle', label: 'Recyclage', category: 'environnement', svgPath: RECYCLE },
  { key: 'water-drop', label: 'Eau', category: 'environnement', svgPath: WATER_DROP },
  { key: 'mountain', label: 'Montagne', category: 'environnement', svgPath: MOUNTAIN },
  { key: 'basket', label: 'Panier', category: 'commerce', svgPath: BASKET },
  { key: 'shop', label: 'Boutique', category: 'commerce', svgPath: SHOP },
  { key: 'paw', label: 'Animalerie', category: 'commerce', svgPath: PAW },
  { key: 'shoe', label: 'Chaussure', category: 'commerce', svgPath: SHOE },
  { key: 'fork-knife', label: 'Restauration', category: 'restauration', svgPath: FORK_KNIFE },
  { key: 'campfire', label: 'Feu de camp', category: 'restauration', svgPath: CAMPFIRE },
  { key: 'bed', label: 'Hébergement', category: 'hebergement', svgPath: BED },
  { key: 'tent', label: 'Camping', category: 'hebergement', svgPath: TENT },
  { key: 'suitcase', label: 'Valise', category: 'hebergement', svgPath: SUITCASE },
  { key: 'ferris-wheel', label: "Parc d'attractions", category: 'loisirs', svgPath: FERRIS_WHEEL },
  { key: 'animal', label: 'Zoo', category: 'loisirs', svgPath: ANIMAL },
  { key: 'wave', label: 'Piscine', category: 'loisirs', svgPath: WAVE },
  { key: 'ball', label: 'Sport', category: 'loisirs', svgPath: BALL },
  { key: 'swing', label: 'Aire de jeux', category: 'loisirs', svgPath: SWING },
  { key: 'museum', label: 'Musée', category: 'loisirs', svgPath: MUSEUM },
  { key: 'camera', label: 'Photo/Tourisme', category: 'loisirs', svgPath: CAMERA },
  {
    key: 'gov-building',
    label: 'Bâtiment public',
    category: 'administration',
    svgPath: GOV_BUILDING,
  },
  { key: 'shield', label: 'Police', category: 'administration', svgPath: SHIELD },
  { key: 'scales', label: 'Justice', category: 'administration', svgPath: SCALES },
  { key: 'flag', label: 'Drapeau', category: 'administration', svgPath: FLAG },
  { key: 'mail', label: 'Courrier', category: 'administration', svgPath: MAIL },
  { key: 'gear', label: 'Services', category: 'administration', svgPath: GEAR },
  { key: 'bus', label: 'Bus', category: 'transport', svgPath: BUS },
  { key: 'plane', label: 'Avion', category: 'transport', svgPath: PLANE },
  { key: 'anchor', label: 'Port', category: 'transport', svgPath: ANCHOR },
  { key: 'train', label: 'Train', category: 'transport', svgPath: TRAIN },
  { key: 'car', label: 'Voiture', category: 'transport', svgPath: CAR },
  { key: 'fuel', label: 'Carburant', category: 'transport', svgPath: FUEL },
  { key: 'parking', label: 'Parking', category: 'transport', svgPath: PARKING },
  { key: 'wifi', label: 'Wifi/Communication', category: 'autre', svgPath: WIFI },
  { key: 'phone', label: 'Téléphone', category: 'autre', svgPath: PHONE },
  { key: 'home', label: 'Bâtiment', category: 'autre', svgPath: HOME },
  { key: 'star', label: 'Étoile', category: 'autre', svgPath: STAR_GLYPH },
  { key: 'clock', label: 'Horaires', category: 'autre', svgPath: CLOCK },
  { key: 'default', label: 'Générique', category: 'autre', svgPath: DEFAULT_GLYPH },
  // Deuxième lot
  { key: 'pharmacy2', label: 'Dentiste', category: 'sante', svgPath: TOOTH },
  { key: 'vet', label: 'Vétérinaire', category: 'sante', svgPath: VET },
  { key: 'ambulance', label: 'Ambulance', category: 'sante', svgPath: AMBULANCE },
  { key: 'microscope', label: 'Laboratoire', category: 'sante', svgPath: MICROSCOPE },
  { key: 'toy-blocks', label: 'Petite enfance', category: 'education', svgPath: TOY_BLOCKS },
  {
    key: 'currency-exchange',
    label: 'Bureau de change',
    category: 'finance',
    svgPath: CURRENCY_EXCHANGE,
  },
  { key: 'well', label: "Point d'eau", category: 'environnement', svgPath: WELL },
  { key: 'bin', label: 'Poubelle', category: 'environnement', svgPath: BIN },
  { key: 'solar-panel', label: 'Panneau solaire', category: 'environnement', svgPath: SOLAR_PANEL },
  { key: 'scissors', label: 'Coiffeur', category: 'commerce', svgPath: SCISSORS },
  { key: 'picnic', label: 'Aire de pique-nique', category: 'restauration', svgPath: PICNIC },
  { key: 'castle', label: 'Château/Monument', category: 'hebergement', svgPath: CASTLE },
  { key: 'dumbbell', label: 'Salle de sport', category: 'loisirs', svgPath: DUMBBELL },
  { key: 'cinema', label: 'Cinéma', category: 'loisirs', svgPath: CINEMA },
  { key: 'viewpoint', label: 'Point de vue', category: 'loisirs', svgPath: VIEWPOINT },
  { key: 'worship', label: 'Lieu de culte', category: 'administration', svgPath: WORSHIP },
  { key: 'fire', label: 'Pompiers', category: 'administration', svgPath: FIRE },
  { key: 'prison', label: 'Prison', category: 'administration', svgPath: PRISON },
  { key: 'bicycle', label: 'Vélo', category: 'transport', svgPath: BICYCLE },
  { key: 'motorcycle', label: 'Moto', category: 'transport', svgPath: MOTORCYCLE },
  { key: 'taxi', label: 'Taxi', category: 'transport', svgPath: TAXI },
  { key: 'boat', label: 'Bateau', category: 'transport', svgPath: BOAT },
  { key: 'bridge', label: 'Pont', category: 'transport', svgPath: BRIDGE },
  { key: 'factory', label: 'Usine', category: 'autre', svgPath: FACTORY },
  { key: 'farm', label: 'Ferme', category: 'autre', svgPath: FARM },
  { key: 'warehouse', label: 'Entrepôt', category: 'autre', svgPath: WAREHOUSE },
  { key: 'antenna', label: 'Antenne', category: 'autre', svgPath: ANTENNA },
];

const ICON_CATALOG_MAP: Record<string, string> = Object.fromEntries(
  ICON_CATALOG.map((i) => [i.key, i.svgPath]),
);

/** Slug -> glyph, keyed by layer slug so two layers can never collide on a shared 2-letter label. */
const SLUG_ICON_GLYPHS: Record<string, string> = {
  // Santé
  hopitaux: CROSS,
  'centres-de-sante-dispensaires': CROSS,
  'imagerie-medicale-radiologie': CROSS,
  'maternite-sage-femme': CROSS,
  'nutrition-dietetique': CROSS,
  // Éducation
  'ecole-primaire': GRAD_CAP,
  'ecole-maternelle': GRAD_CAP,
  'universite-enseignement-superieur': GRAD_CAP,
  'bibliotheque-universitaire': GRAD_CAP,
  'centre-formation-professionnelle': GRAD_CAP,
  // Finance
  'atm-distributeurs': BANK,
  microfinance: BANK,
  'bourse-marche-financier': BANK,
  'cooperative-epargne-credit': BANK,
  'mobile-money': BANK,
  // Environnement
  'espaces-verts-parcs': TREE,
  'gestion-dechets-recyclage': TREE,
  'stations-epuration': TREE,
  'reserves-naturelles-aires-protegees': TREE,
  'qualite-air-stations': TREE,
  // Commerce et Shopping
  librairie: BOOK,
  'marche-local': BASKET,
  animalerie: PAW,
  cordonnerie: SHOE,
  'magasin-bio': LEAF,
  // Restauration
  'pub-brasserie': FORK_KNIFE,
  'food-truck': FORK_KNIFE,
  'traiteur-evenementiel': FORK_KNIFE,
  'bar-chicha-lounge': FORK_KNIFE,
  'cave-a-vin': FORK_KNIFE,
  // Hébergement
  'residence-meublee-apparthotel': BED,
  'chambre-dhotes': BED,
  'auberge-jeunesse': BED,
  camping: TENT,
  motel: BED,
  // Loisirs
  'parc-attractions': FERRIS_WHEEL,
  'zoo-parc-animalier': ANIMAL,
  'piscine-publique': WAVE,
  'terrain-sport-stade': BALL,
  'aire-jeux-enfants': SWING,
  // Administration et Institutions Publiques
  'mairies-communes': GOV_BUILDING,
  tribunaux: SCALES,
  'police-gendarmerie': SHIELD,
  prefectures: GOV_BUILDING,
  'services-impots': GOV_BUILDING,
  // Automobile et Transport
  'gare-routiere-bus': BUS,
  aeroport: PLANE,
  'port-embarcadere': ANCHOR,
  'gare-ferroviaire': TRAIN,
  'location-vehicules': CAR,
};

/**
 * Resolve the inner glyph for a layer icon. Prefers the layer slug (iconKey) since it
 * uniquely identifies every layer; falls back to the legacy 2-3 letter label lookup for
 * any caller that hasn't been updated to pass iconKey yet.
 */
function getInnerIconPath(iconKey?: string, label?: string): string | null {
  if (iconKey && SLUG_ICON_GLYPHS[iconKey]) {
    return SLUG_ICON_GLYPHS[iconKey];
  }
  if (iconKey && ICON_CATALOG_MAP[iconKey]) {
    return ICON_CATALOG_MAP[iconKey];
  }

  switch (label) {
    case 'H':
    case 'CS':
    case 'IM':
    case 'MA':
    case 'NU':
      return CROSS;
    case 'EP':
    case 'EM':
    case 'UN':
    case 'BU':
    case 'CF':
      return GRAD_CAP;
    case 'AT':
    case 'MF':
    case 'BF':
    case 'CE':
    case 'MM':
      return BANK;
    case 'EV':
    case 'RN':
    case 'GD':
    case 'SE':
    case 'QA':
      return TREE;
    case 'AE':
      return PLANE;
    case 'PT':
      return ANCHOR;
    case 'GF':
      return TRAIN;
    case 'BS':
      return BUS;
    case 'LV':
      return CAR;
    case 'PO':
      return SHIELD;
    case 'TR':
      return SCALES;
    case 'PR':
    case 'SI':
      return GOV_BUILDING;
    case 'PB':
    case 'FT':
    case 'BC':
    case 'CV':
      return FORK_KNIFE;
    case 'RM':
    case 'CH':
    case 'AJ':
    case 'MO':
      return BED;
    case 'CA':
      return TENT;
    default:
      return label ? DEFAULT_GLYPH : null;
  }
}
