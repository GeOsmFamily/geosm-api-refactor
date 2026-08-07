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

// ─── Troisième lot de glyphes (2026-08-06) : 140 icônes supplémentaires réparties sur 17
// nouvelles thématiques (agriculture, énergie, eau/assainissement, sécurité, culture, sport,
// technologie, immobilier, industrie, humanitaire, religion, tourisme, services publics,
// télécommunications, urbanisme, météo, véhicules spécialisés) - même convention que les lots
// précédents (canevas 32x32, trait/remplissage blanc, 1 à 4 primitives SVG simples par glyphe).

// Agriculture
const TRACTOR = `<path d="M8 20h6v-6h4l3 3h4v3h2" stroke="#ffffff" stroke-width="1.4" fill="none"/><circle cx="12" cy="22" r="2.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="22" cy="22" r="1.8" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const PLOW = `<path d="M8 22h16M10 22l3-8M15 22l3-8M20 22l3-8" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
const SILO = `<path d="M12 24V12a4 4 0 0 1 8 0v12z M12 16h8" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const GREENHOUSE = `<path d="M8 24V14l8-5 8 5v10z M8 14h16 M12 14v10m4-10v10m4-10v10" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const IRRIGATION = `<circle cx="16" cy="14" r="3" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 19v3m-5-2l2 2m8-2l-2 2" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const LIVESTOCK = `<path d="M13 13c-2 0-3 2-2 3 M19 13c2 0 3 2 2 3 M16 12a5 5 0 0 0-5 5c0 3 2 6 5 6s5-3 5-6a5 5 0 0 0-5-5z" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const BEEHIVE = `<path d="M12 24h8l-1-4h-6zM12.5 20h7l-.8-4h-5.4zM13 16h6l-.6-4h-4.8z" fill="#ffffff"/>`;
const ORCHARD = `<circle cx="12" cy="13" r="3.5" fill="#ffffff"/><circle cx="20" cy="11" r="3.5" fill="#ffffff"/><path d="M12 16v8m8-9v9" stroke="#ffffff" stroke-width="1.4"/>`;
const SEED = `<ellipse cx="16" cy="20" rx="3" ry="4" fill="#ffffff"/><path d="M16 16c0-3 2-5 4-5 0 3-2 5-4 5z" fill="#ffffff"/>`;
const HARVEST = `<path d="M16 24V12M16 12l-3-3M16 12l3-3M16 16l-4-2M16 16l4-2M16 20l-4-2M16 20l4-2" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;

// Énergie
const WIND_TURBINE = `<path d="M16 24V10" stroke="#ffffff" stroke-width="1.5"/><path d="M16 10l5 3M16 10l-4 5M16 10l3-6" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const POWER_LINE = `<path d="M16 9v15M11 13h10M9 13l4-2M23 13l-4-2M9 24l7-11 7 11" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const GENERATOR = `<rect x="9" y="12" width="14" height="10" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M17 14l-3 4h3l-3 4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const OIL_DERRICK = `<path d="M16 9l6 15h-4l-2-6-2 6h-4z M12 18h8" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const BATTERY = `<rect x="10" y="12" width="12" height="10" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="14" y="10" width="4" height="2" fill="#ffffff"/><path d="M18 14l-3 4h3l-3 4" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
const POWER_PLANT = `<path d="M10 24V16a3 5 0 1 1 6 0v8zm10 0V16a3 5 0 1 1 6 0v8z" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const TRANSFORMER = `<rect x="11" y="11" width="10" height="11" rx="2" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M11 15h10m-10 4h10" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const COAL = `<path d="M9 22c0-3 2-4 3-4 1-2 3-3 4-2 1-1 3-1 4 1 2 0 3 2 3 5z" fill="#ffffff"/>`;
const GAS_CANISTER = `<rect x="12" y="13" width="8" height="11" rx="2" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="14.5" y="9" width="3" height="4" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;

// Eau et assainissement
const FAUCET = `<path d="M10 12h6v4h4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M20 16c0 2-2 3-2 5a2 2 0 1 0 4 0c0-2-2-3-2-5z" fill="#ffffff"/>`;
const WATER_TANK = `<rect x="10" y="10" width="12" height="9" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M12 19l-2 5m10-5l2 5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const SEWAGE = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M11 16c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const DAM = `<path d="M9 13h14v6H9z M9 19c2 2 4 2 6 0s4-2 6 0 2 2 2 2" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const WATER_PUMP = `<rect x="13" y="14" width="6" height="8" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 14v-4m-3 1h6" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
const BOREHOLE = `<circle cx="16" cy="14" r="4" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 18v6" stroke="#ffffff" stroke-width="1.3" stroke-dasharray="2 2"/>`;
const WATER_TREATMENT = `<circle cx="11" cy="18" r="2.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="14" r="2.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="21" cy="18" r="2.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M13 17l2-2m2 2l2-2" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const IRRIGATION_CANAL = `<path d="M8 14c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M8 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;

// Sécurité
const FIRE_EXTINGUISHER = `<rect x="13" y="13" width="6" height="10" rx="2" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 13v-2m-2 0h4m0 3l3-1" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
const CCTV = `<path d="M10 14h8l3 2v4l-3 2h-8z M10 14v8" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const ALARM = `<path d="M16 9a5 5 0 0 1 5 5v3l2 3H9l2-3v-3a5 5 0 0 1 5-5z M14 22a2 2 0 0 0 4 0" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const HELMET = `<path d="M9 20a7 6 0 0 1 14 0z M8 20h16" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const BARRIER = `<rect x="8" y="14" width="16" height="4" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M11 14l-2 4m6-4l-2 4m6-4l-2 4m6-4l-2 4" stroke="#ffffff" stroke-width="1"/>`;
const CHECKPOINT = `<path d="M16 9c3 1 5 1 5 1s1 3 1 6c0 4-6 7-6 7s-6-3-6-7c0-3 1-6 1-6s2 0 5-1z M13 16l2 2 4-4" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const WATCHTOWER = `<path d="M11 24l2-10h6l2 10 M13 14h6l1.5-5h-9z" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/>`;
const HANDCUFFS = `<circle cx="12" cy="16" r="3.5" stroke="#ffffff" stroke-width="1.4" fill="none"/><circle cx="20" cy="16" r="3.5" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M15.5 16h1" stroke="#ffffff" stroke-width="1.4"/>`;

// Culture
const THEATRE_MASKS = `<ellipse cx="12" cy="15" rx="4" ry="5" stroke="#ffffff" stroke-width="1.2" fill="none"/><ellipse cx="20" cy="17" rx="4" ry="5" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const ART_GALLERY = `<rect x="9" y="10" width="14" height="12" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M11 19l3-4 2.5 3 1.5-2 3 3" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const MONUMENT = `<path d="M16 9l2 6h-4z M14 15h4v9h-4z" fill="#ffffff"/>`;
const SCULPTURE = `<rect x="12" y="20" width="8" height="4" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="14" r="4" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const AMPHITHEATER = `<path d="M8 22a8 5 0 0 1 16 0" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M10 22a6 3.5 0 0 1 12 0" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const GALLERY_FRAME = `<rect x="10" y="9" width="12" height="9" stroke="#ffffff" stroke-width="1.2" fill="none"/><rect x="12" y="17" width="8" height="7" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const PALACE = `<path d="M9 24V15h4v9zm5 0V13h4v11zm5 0v-9h4v9z M11 15a2 2 0 0 1 4 0m1-2a2 2 0 0 1 4 0" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const HERITAGE_SITE = `<path d="M16 9l4 1.5v5c0 4-4 6.5-4 6.5s-4-2.5-4-6.5v-5z" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 13l1 2 2 .2-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.2z" fill="#ffffff"/>`;

// Sport
const FOOTBALL = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M16 11l3 2-1 3.5h-4l-1-3.5z" fill="#ffffff"/>`;
const BASKETBALL = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M9 16h14M16 9v14M11 11c2 2 2 8 0 10m10-10c-2 2-2 8 0 10" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const TENNIS = `<ellipse cx="14" cy="13" rx="4.5" ry="5.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M17 17l6 6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>`;
const VOLLEYBALL = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.4" fill="none"/><path d="M10 12c3 1 9 1 12 4M10 20c3-1 9-1 12-4" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const ATHLETICS_TRACK = `<ellipse cx="16" cy="16" rx="8" ry="5" stroke="#ffffff" stroke-width="1.3" fill="none"/><ellipse cx="16" cy="16" rx="5" ry="3" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const BOXING = `<path d="M11 16a4 4 0 0 1 8 0v3a3 3 0 0 1-3 3h-2l-3-3z" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const CYCLING_TRACK = `<path d="M8 20a8 4 0 0 1 16 0" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="11" cy="20" r="2" stroke="#ffffff" stroke-width="1.1" fill="none"/><circle cx="21" cy="20" r="2" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const GOLF = `<path d="M12 24V10l6 2-6 2" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/><circle cx="20" cy="23" r="1.3" fill="#ffffff"/>`;
const TABLE_TENNIS = `<circle cx="13" cy="14" r="4" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 17l5 5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/><circle cx="22" cy="11" r="1.3" fill="#ffffff"/>`;
const MARTIAL_ARTS = `<circle cx="16" cy="14" r="4" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M11 20h10l-2 4h-6z" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const ARCHERY = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="16" r="4" stroke="#ffffff" stroke-width="1" fill="none"/><circle cx="16" cy="16" r="1.3" fill="#ffffff"/>`;
const SKATEBOARD = `<path d="M8 17c3-1.5 13-1.5 16 0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="11" cy="19" r="1.3" fill="#ffffff"/><circle cx="21" cy="19" r="1.3" fill="#ffffff"/>`;

// Technologie
const COMPUTER = `<rect x="9" y="10" width="14" height="9" rx="1" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M14 22h4m-2-3v3" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const SERVER = `<rect x="10" y="10" width="12" height="4.5" rx="1" stroke="#ffffff" stroke-width="1.2" fill="none"/><rect x="10" y="17.5" width="12" height="4.5" rx="1" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="13" cy="12.2" r=".8" fill="#ffffff"/><circle cx="13" cy="19.7" r=".8" fill="#ffffff"/>`;
const SATELLITE_DISH = `<path d="M9 16a8 8 0 0 1 14-5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 16v6m-3 0h6" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/><circle cx="21" cy="10" r="1.2" fill="#ffffff"/>`;
const DRONE = `<path d="M11 11l10 10M21 11l-10 10" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/><circle cx="11" cy="11" r="2" stroke="#ffffff" stroke-width="1" fill="none"/><circle cx="21" cy="11" r="2" stroke="#ffffff" stroke-width="1" fill="none"/><circle cx="11" cy="21" r="2" stroke="#ffffff" stroke-width="1" fill="none"/><circle cx="21" cy="21" r="2" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const PRINTER = `<rect x="9" y="13" width="14" height="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="12" y="9" width="8" height="4" stroke="#ffffff" stroke-width="1.1" fill="none"/><rect x="12" y="20" width="8" height="4" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const ROUTER = `<rect x="9" y="16" width="14" height="5" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M13 16v-4m6 4v-4" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>`;
const SMARTPHONE = `<rect x="12" y="8" width="8" height="16" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M15 21h2" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const LAPTOP = `<rect x="11" y="10" width="10" height="7" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M8 21h16l-2-3H10z" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
const ROBOT = `<rect x="11" y="13" width="10" height="9" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 13v-3" stroke="#ffffff" stroke-width="1.2"/><circle cx="14" cy="17" r=".9" fill="#ffffff"/><circle cx="18" cy="17" r=".9" fill="#ffffff"/>`;

// Immobilier
const APARTMENT_BUILDING = `<rect x="10" y="9" width="12" height="15" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M13 12h2m3 0h2m-7 4h2m3 0h2m-7 4h2m3 0h2" stroke="#ffffff" stroke-width="1"/>`;
const CONSTRUCTION_CRANE = `<path d="M11 24V10h10M11 10l6 3" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M17 13v4" stroke="#ffffff" stroke-width="1" stroke-dasharray="1 1"/>`;
const LAND_PLOT = `<rect x="9" y="11" width="14" height="10" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/><circle cx="9" cy="11" r="1" fill="#ffffff"/><circle cx="23" cy="21" r="1" fill="#ffffff"/>`;
const REAL_ESTATE_SIGN = `<path d="M18 24V10" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/><rect x="9" y="10" width="9" height="6" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const SKYSCRAPER = `<path d="M12 24V15h4v-4h2v4h4v9z" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const HOUSE_FOR_SALE = `<path d="M16 9l7 6h-2v9h-10v-9h-2z" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/><circle cx="20" cy="12" r="1.2" fill="#ffffff"/>`;
const GATE = `<path d="M10 10v14M22 10v14M10 15h12" stroke="#ffffff" stroke-width="1.4" fill="none"/>`;
const FENCE = `<path d="M9 24V13l2-2 2 2v11M15 24V13l2-2 2 2v11M21 24V13l2-2 2 2v11M8 18h18" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;

// Industrie
const CRANE_INDUSTRIAL = `<path d="M16 24V9M16 9h8M9 12l7-3" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const FORKLIFT = `<rect x="9" y="15" width="8" height="6" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M17 21V12M20 12v9" stroke="#ffffff" stroke-width="1.3"/><circle cx="11" cy="22.5" r="1.3" fill="#ffffff"/><circle cx="16" cy="22.5" r="1.3" fill="#ffffff"/>`;
const PIPELINE = `<path d="M8 16h16" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M13 13v6m6-6v6" stroke="#ffffff" stroke-width="1"/>`;
const CONTAINER = `<rect x="8" y="12" width="16" height="9" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M11 12v9m3-9v9m3-9v9m3-9v9m3-9v9" stroke="#ffffff" stroke-width=".8"/>`;
const MINING = `<path d="M10 22l8-8m4-4l-2 2M22 22l-8-8m-4-4l2 2" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`;
const CONVEYOR = `<path d="M8 20h16" stroke="#ffffff" stroke-width="1.4"/><circle cx="11" cy="20" r="1.5" stroke="#ffffff" stroke-width="1" fill="none"/><circle cx="21" cy="20" r="1.5" stroke="#ffffff" stroke-width="1" fill="none"/><path d="M9 16l14-2" stroke="#ffffff" stroke-width="1.2"/>`;
const SILO_INDUSTRIAL = `<rect x="10" y="11" width="12" height="11" rx="3" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M10 15h12" stroke="#ffffff" stroke-width="1"/>`;
const CHIMNEY = `<rect x="14" y="14" width="4" height="10" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 12c1-1 0-2 1-3m-1 3c-1-1 0-2-1-3" stroke="#ffffff" stroke-width="1" stroke-linecap="round" fill="none"/>`;

// Humanitaire
const AID_BOX = `<rect x="9" y="12" width="14" height="10" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 14v6m-3-3h6" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>`;
const REFUGEE_TENT = `<path d="M8 22a8 6 0 0 1 16 0z" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 16v6" stroke="#ffffff" stroke-width="1"/>`;
const RED_CROSS_TENT = `<path d="M16 9l8 13H8z" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M16 16v4m-2-2h4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const WATER_TRUCK = `<rect x="8" y="16" width="10" height="5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="21" cy="17.5" r="3.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="11" cy="22.5" r="1.3" fill="#ffffff"/><circle cx="18" cy="22.5" r="1.3" fill="#ffffff"/>`;
const FOOD_DISTRIBUTION = `<path d="M9 16h14l-1.5 8h-11z" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 10v4m-2-2h4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const NGO_FLAG = `<path d="M11 9v14 M11 10h10l-2.5 3.5L21 17H11" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" fill="none"/><path d="M15 12.5c0-1 1.5-1 1.5 0 0-1 1.5-1 1.5 0 0 1-1.5 2-1.5 2s-1.5-1-1.5-2z" fill="#ffffff"/>`;
const FIRST_AID_KIT = `<path d="M9 13h14v9H9z M13 13v-2h6v2" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M16 15v5m-2.5-2.5h5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>`;
const BLANKET = `<rect x="9" y="13" width="14" height="8" rx="1" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M9 17h14" stroke="#ffffff" stroke-width="1"/>`;

// Religion
const MOSQUE = `<path d="M9 24V17a7 6 0 0 1 14 0v7z M16 10l1 2h-2z" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const CHURCH = `<path d="M10 24V15l6-4 6 4v9z M16 11V8m-1.5 1.5h3" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
const TEMPLE = `<path d="M8 24h16M9 24V14m4 10V14m6 10V14m4 10V14M8 14l8-5 8 5" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round" fill="none"/>`;
const SYNAGOGUE = `<path d="M9 24V17a7 6 0 0 1 14 0v7z" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M13 12l3-2 3 2-1 3h-4z" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const PAGODA = `<path d="M16 9l6 4H10zM12 13l8 0M13 17h6M11 21h10M16 24V13" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round" fill="none"/>`;
const SHRINE = `<path d="M8 13h16M9 13v11M23 13v11M7 10h18" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;

// Tourisme et nature
const WATERFALL = `<path d="M8 12l5 6-5 6z" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M14 12v12m3-12v12m3-12v12" stroke="#ffffff" stroke-width="1" stroke-dasharray="1.5 1.5"/>`;
const CAVE = `<path d="M8 24a8 9 0 0 1 16 0z" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M12 24a4 5 0 0 1 8 0" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const BEACH = `<circle cx="12" cy="12" r="3" fill="#ffffff"/><path d="M8 22c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
const HIKING_TRAIL = `<path d="M9 23l5-9 3 5 2-3 4 7" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M8 24h16" stroke="#ffffff" stroke-width="1" stroke-dasharray="1.5 1.5"/>`;
const NATIONAL_PARK_GATE = `<path d="M10 24V11h12v13" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M9 11h14" stroke="#ffffff" stroke-width="1.3"/>`;
const SAFARI = `<circle cx="12.5" cy="16" r="3" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="19.5" cy="16" r="3" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M15 15h2" stroke="#ffffff" stroke-width="1.3"/>`;
const HOT_SPRING = `<ellipse cx="16" cy="20" rx="7" ry="3" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M13 15c0-2 1-2 1-4m4 4c0-2 1-2 1-4" stroke="#ffffff" stroke-width="1" stroke-linecap="round" fill="none"/>`;
const CANYON = `<path d="M8 24V17l4-3 4 3v7M16 24v-9l4-3 4 3v9" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round" fill="none"/>`;
const ISLAND = `<ellipse cx="16" cy="23" rx="7" ry="1.5" stroke="#ffffff" stroke-width="1" fill="none"/><path d="M16 23V13m0 0c-2-1-3 0-4 1m4-1c2-1 3 0 4 1m-4-1c1-2 0-3-1-4" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
const LIGHTHOUSE = `<path d="M14 24V15h4v9z M13 15l1-6h4l1 6 M15 9h2" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;

// Services publics
const POST_OFFICE = `<rect x="9" y="13" width="14" height="9" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M9 13l7 5 7-5" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const VOTING_BOX = `<rect x="9" y="14" width="14" height="9" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M14 14v-3l2-2 2 2v3" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
const CIVIL_REGISTRY = `<rect x="10" y="9" width="10" height="14" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="20" cy="20" r="3" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const CUSTOMS = `<path d="M8 20h12M8 20l3-2m-3 2l3 2" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M22 10v12" stroke="#ffffff" stroke-width="1.3"/><path d="M22 10l4 1.5-4 1.5z" fill="#ffffff"/>`;
const EMBASSY = `<rect x="9" y="14" width="14" height="10" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 14V9" stroke="#ffffff" stroke-width="1.2"/><path d="M16 9l4 1.5-4 1.5z" fill="#ffffff"/>`;
const CITY_HALL = `<path d="M8 24h16M9 24V14l7-5 7 5v10M13 24v-6h6v6" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round" fill="none"/><circle cx="16" cy="12" r="1.5" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const ARCHIVE = `<rect x="9" y="11" width="14" height="5" stroke="#ffffff" stroke-width="1.2" fill="none"/><rect x="9" y="17" width="14" height="5" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const NOTARY = `<rect x="13" y="9" width="6" height="8" rx="1" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M11 22h10l-1-5H12z" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;

// Télécommunications
const CELL_TOWER = `<path d="M16 9l-4 15h8zM12 18h8M13.5 13.5h5" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const FIBER_CABLE = `<path d="M8 16c3-3 6 3 9 0s6-3 7 0" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="8" cy="16" r="1.2" fill="#ffffff"/><circle cx="24" cy="16" r="1.2" fill="#ffffff"/>`;
const RADIO_TOWER = `<path d="M16 24V11" stroke="#ffffff" stroke-width="1.4"/><path d="M12 11a4 4 0 0 1 8 0" stroke="#ffffff" stroke-width="1.1" fill="none"/><path d="M10 9a7 7 0 0 1 12 0" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const TV_TOWER = `<path d="M16 24V9m-3 5h6m-5 4h4" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="9" r="1.3" fill="#ffffff"/>`;
const SATELLITE = `<rect x="14" y="14" width="4" height="4" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M14 16H9m9 0h5M16 14v-3m0 8v3" stroke="#ffffff" stroke-width="1.1"/>`;
const BROADCAST = `<circle cx="16" cy="16" r="1.5" fill="#ffffff"/><path d="M12 12a6 6 0 0 1 8 0M9.5 9.5a10 10 0 0 1 13 0M12 20a6 6 0 0 0 8 0M9.5 22.5a10 10 0 0 0 13 0" stroke="#ffffff" stroke-width="1" fill="none"/>`;

// Urbanisme
const STREET_LIGHT = `<path d="M16 24V11" stroke="#ffffff" stroke-width="1.4"/><path d="M16 11h4l-2-3z" fill="#ffffff"/>`;
const TRAFFIC_LIGHT = `<rect x="13" y="9" width="6" height="12" rx="1.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="12" r="1" fill="#ffffff"/><circle cx="16" cy="15" r="1" fill="#ffffff"/><circle cx="16" cy="18" r="1" fill="#ffffff"/>`;
const ROAD_SIGN = `<path d="M16 24V16" stroke="#ffffff" stroke-width="1.3"/><path d="M16 9l5 8H11z" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/>`;
const ROUNDABOUT = `<circle cx="16" cy="16" r="6" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M22 16l2-1v2z" fill="#ffffff"/>`;
const PEDESTRIAN_CROSSING = `<path d="M9 12v8M13 12v8M17 12v8M21 12v8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`;
const SIDEWALK = `<path d="M10 9l-3 15M22 9l3 15M12 13h8m-9 4h10" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;
const SEWER_COVER = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M9 16h14M16 9v14M11.5 11.5l9 9m0-9l-9 9" stroke="#ffffff" stroke-width=".8"/>`;
const MANHOLE = `<circle cx="16" cy="16" r="7" stroke="#ffffff" stroke-width="1.3" fill="none"/><circle cx="16" cy="16" r="3" stroke="#ffffff" stroke-width="1" fill="none"/>`;
const BENCH = `<path d="M9 15h14M9 15v3m14-3v3M11 18v4m10-4v4" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
const BUS_STOP = `<path d="M12 24V10h8" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="12" y="10" width="6" height="4" stroke="#ffffff" stroke-width="1.1" fill="none"/>`;

// Météo
const SUN = `<circle cx="16" cy="16" r="4.5" fill="#ffffff"/><path d="M16 8v2m0 12v2m8-8h-2M10 16H8m11.5-5.5l-1.4 1.4m-8.2 8.2-1.4 1.4m0-11 1.4 1.4m8.2 8.2 1.4 1.4" stroke="#ffffff" stroke-width="1.2"/>`;
const RAIN = `<path d="M10 16a5 5 0 0 1 9-3 4 4 0 0 1 3 7H11a4 4 0 0 1-1-4z" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M12 22l-1 2m5-2l-1 2m5-2l-1 2" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>`;
const CLOUD = `<path d="M10 19a5 5 0 0 1 9-3 4 4 0 0 1 3 7H11a4 4 0 0 1-1-4z" stroke="#ffffff" stroke-width="1.3" fill="none"/>`;
const THERMOMETER = `<rect x="14.5" y="9" width="3" height="11" rx="1.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="16" cy="21" r="2.5" fill="#ffffff"/>`;
const WIND = `<path d="M8 13h10a2 2 0 1 0-2-2M8 17h13a2 2 0 1 1-2 2M8 21h8" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
const STORM = `<path d="M10 16a5 5 0 0 1 9-3 4 4 0 0 1 3 7H11a4 4 0 0 1-1-4z" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M17 17l-3 4h3l-2 3" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;

// Véhicules spécialisés
const FIRE_TRUCK = `<rect x="8" y="15" width="14" height="6" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M10 15l3-4h8" stroke="#ffffff" stroke-width="1.1" fill="none"/><circle cx="11" cy="22.5" r="1.3" fill="#ffffff"/><circle cx="19" cy="22.5" r="1.3" fill="#ffffff"/>`;
const TANKER_TRUCK = `<rect x="8" y="15" width="6" height="6" stroke="#ffffff" stroke-width="1.2" fill="none"/><ellipse cx="19" cy="18" rx="5" ry="3.5" stroke="#ffffff" stroke-width="1.2" fill="none"/><circle cx="11" cy="22.5" r="1.2" fill="#ffffff"/><circle cx="19" cy="22.5" r="1.2" fill="#ffffff"/>`;
const TRAM = `<rect x="10" y="11" width="12" height="9" rx="1.5" stroke="#ffffff" stroke-width="1.3" fill="none"/><path d="M16 11V8" stroke="#ffffff" stroke-width="1.1"/><circle cx="13" cy="22" r="1.2" fill="#ffffff"/><circle cx="19" cy="22" r="1.2" fill="#ffffff"/>`;
const SCOOTER = `<circle cx="11" cy="22" r="2" stroke="#ffffff" stroke-width="1.2" fill="none"/><path d="M11 22h9l3-11m-3 11l2-4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
const CABLE_CAR = `<path d="M8 11h16" stroke="#ffffff" stroke-width="1.2"/><path d="M13 11l3 4 3-4" stroke="#ffffff" stroke-width="1" fill="none"/><rect x="12" y="15" width="8" height="6" rx="1" stroke="#ffffff" stroke-width="1.2" fill="none"/>`;
const PICKUP_TRUCK = `<path d="M8 20V15h6l2-3h4v3h3v5z" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" fill="none"/><circle cx="11" cy="21" r="1.3" fill="#ffffff"/><circle cx="20" cy="21" r="1.3" fill="#ffffff"/>`;

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
  // Troisième lot (2026-08-06) - 140 icônes, 17 nouvelles thématiques
  // Agriculture
  { key: 'tractor', label: 'Tracteur', category: 'agriculture', svgPath: TRACTOR },
  { key: 'plow', label: 'Labour', category: 'agriculture', svgPath: PLOW },
  { key: 'silo', label: 'Silo', category: 'agriculture', svgPath: SILO },
  { key: 'greenhouse', label: 'Serre', category: 'agriculture', svgPath: GREENHOUSE },
  { key: 'irrigation', label: 'Irrigation', category: 'agriculture', svgPath: IRRIGATION },
  { key: 'livestock', label: 'Élevage', category: 'agriculture', svgPath: LIVESTOCK },
  { key: 'beehive', label: 'Apiculture', category: 'agriculture', svgPath: BEEHIVE },
  { key: 'orchard', label: 'Verger', category: 'agriculture', svgPath: ORCHARD },
  { key: 'seed', label: 'Semences', category: 'agriculture', svgPath: SEED },
  { key: 'harvest', label: 'Récolte', category: 'agriculture', svgPath: HARVEST },
  // Énergie
  { key: 'wind-turbine', label: 'Éolienne', category: 'energie', svgPath: WIND_TURBINE },
  { key: 'power-line', label: 'Ligne électrique', category: 'energie', svgPath: POWER_LINE },
  { key: 'generator', label: 'Groupe électrogène', category: 'energie', svgPath: GENERATOR },
  { key: 'oil-derrick', label: 'Derrick pétrolier', category: 'energie', svgPath: OIL_DERRICK },
  { key: 'battery', label: 'Batterie/Stockage', category: 'energie', svgPath: BATTERY },
  { key: 'power-plant', label: 'Centrale électrique', category: 'energie', svgPath: POWER_PLANT },
  { key: 'transformer', label: 'Transformateur', category: 'energie', svgPath: TRANSFORMER },
  { key: 'coal', label: 'Charbon', category: 'energie', svgPath: COAL },
  { key: 'gas-canister', label: 'Bouteille de gaz', category: 'energie', svgPath: GAS_CANISTER },
  // Eau et assainissement
  { key: 'faucet', label: 'Robinet', category: 'eau', svgPath: FAUCET },
  { key: 'water-tank', label: "Château d'eau", category: 'eau', svgPath: WATER_TANK },
  { key: 'sewage', label: 'Assainissement', category: 'eau', svgPath: SEWAGE },
  { key: 'dam', label: 'Barrage', category: 'eau', svgPath: DAM },
  { key: 'water-pump', label: 'Pompe à eau', category: 'eau', svgPath: WATER_PUMP },
  { key: 'borehole', label: 'Forage', category: 'eau', svgPath: BOREHOLE },
  {
    key: 'water-treatment',
    label: "Station de traitement d'eau",
    category: 'eau',
    svgPath: WATER_TREATMENT,
  },
  {
    key: 'irrigation-canal',
    label: "Canal d'irrigation",
    category: 'eau',
    svgPath: IRRIGATION_CANAL,
  },
  // Sécurité
  {
    key: 'fire-extinguisher',
    label: 'Extincteur',
    category: 'securite',
    svgPath: FIRE_EXTINGUISHER,
  },
  { key: 'cctv', label: 'Vidéosurveillance', category: 'securite', svgPath: CCTV },
  { key: 'alarm', label: 'Alarme', category: 'securite', svgPath: ALARM },
  { key: 'helmet', label: 'Protection/Chantier', category: 'securite', svgPath: HELMET },
  { key: 'barrier', label: 'Barrière de sécurité', category: 'securite', svgPath: BARRIER },
  { key: 'checkpoint', label: 'Poste de contrôle', category: 'securite', svgPath: CHECKPOINT },
  { key: 'watchtower', label: 'Tour de guet', category: 'securite', svgPath: WATCHTOWER },
  { key: 'handcuffs', label: 'Sécurité publique', category: 'securite', svgPath: HANDCUFFS },
  // Culture
  { key: 'theatre-masks', label: 'Théâtre', category: 'culture', svgPath: THEATRE_MASKS },
  { key: 'art-gallery', label: "Galerie d'art", category: 'culture', svgPath: ART_GALLERY },
  { key: 'monument', label: 'Monument', category: 'culture', svgPath: MONUMENT },
  { key: 'sculpture', label: 'Sculpture', category: 'culture', svgPath: SCULPTURE },
  { key: 'amphitheater', label: 'Amphithéâtre', category: 'culture', svgPath: AMPHITHEATER },
  { key: 'gallery-frame', label: 'Exposition', category: 'culture', svgPath: GALLERY_FRAME },
  { key: 'palace', label: 'Palais', category: 'culture', svgPath: PALACE },
  { key: 'heritage-site', label: 'Site patrimonial', category: 'culture', svgPath: HERITAGE_SITE },
  // Sport
  { key: 'football', label: 'Football', category: 'sport', svgPath: FOOTBALL },
  { key: 'basketball', label: 'Basketball', category: 'sport', svgPath: BASKETBALL },
  { key: 'tennis', label: 'Tennis', category: 'sport', svgPath: TENNIS },
  { key: 'volleyball', label: 'Volleyball', category: 'sport', svgPath: VOLLEYBALL },
  {
    key: 'athletics-track',
    label: "Piste d'athlétisme",
    category: 'sport',
    svgPath: ATHLETICS_TRACK,
  },
  { key: 'boxing', label: 'Boxe', category: 'sport', svgPath: BOXING },
  { key: 'cycling-track', label: 'Piste cyclable', category: 'sport', svgPath: CYCLING_TRACK },
  { key: 'golf', label: 'Golf', category: 'sport', svgPath: GOLF },
  { key: 'table-tennis', label: 'Tennis de table', category: 'sport', svgPath: TABLE_TENNIS },
  { key: 'martial-arts', label: 'Arts martiaux', category: 'sport', svgPath: MARTIAL_ARTS },
  { key: 'archery', label: "Tir à l'arc", category: 'sport', svgPath: ARCHERY },
  { key: 'skateboard', label: 'Skatepark', category: 'sport', svgPath: SKATEBOARD },
  // Technologie
  { key: 'computer', label: 'Ordinateur', category: 'technologie', svgPath: COMPUTER },
  { key: 'server', label: 'Serveur/Data center', category: 'technologie', svgPath: SERVER },
  {
    key: 'satellite-dish',
    label: 'Antenne parabolique',
    category: 'technologie',
    svgPath: SATELLITE_DISH,
  },
  { key: 'drone', label: 'Drone', category: 'technologie', svgPath: DRONE },
  { key: 'printer', label: 'Imprimerie', category: 'technologie', svgPath: PRINTER },
  { key: 'router', label: 'Routeur réseau', category: 'technologie', svgPath: ROUTER },
  { key: 'smartphone', label: 'Téléphonie mobile', category: 'technologie', svgPath: SMARTPHONE },
  { key: 'laptop', label: 'Espace numérique', category: 'technologie', svgPath: LAPTOP },
  { key: 'robot', label: 'Robotique', category: 'technologie', svgPath: ROBOT },
  // Immobilier
  {
    key: 'apartment-building',
    label: "Immeuble d'habitation",
    category: 'immobilier',
    svgPath: APARTMENT_BUILDING,
  },
  {
    key: 'construction-crane',
    label: 'Chantier de construction',
    category: 'immobilier',
    svgPath: CONSTRUCTION_CRANE,
  },
  { key: 'land-plot', label: 'Parcelle', category: 'immobilier', svgPath: LAND_PLOT },
  {
    key: 'real-estate-sign',
    label: 'Agence immobilière',
    category: 'immobilier',
    svgPath: REAL_ESTATE_SIGN,
  },
  { key: 'skyscraper', label: 'Tour/Gratte-ciel', category: 'immobilier', svgPath: SKYSCRAPER },
  {
    key: 'house-for-sale',
    label: 'Bien à vendre',
    category: 'immobilier',
    svgPath: HOUSE_FOR_SALE,
  },
  { key: 'gate', label: 'Portail', category: 'immobilier', svgPath: GATE },
  { key: 'fence', label: 'Clôture', category: 'immobilier', svgPath: FENCE },
  // Industrie
  {
    key: 'crane-industrial',
    label: 'Grue industrielle',
    category: 'industrie',
    svgPath: CRANE_INDUSTRIAL,
  },
  { key: 'forklift', label: 'Chariot élévateur', category: 'industrie', svgPath: FORKLIFT },
  { key: 'pipeline', label: 'Pipeline', category: 'industrie', svgPath: PIPELINE },
  { key: 'container', label: 'Conteneur', category: 'industrie', svgPath: CONTAINER },
  { key: 'mining', label: 'Site minier', category: 'industrie', svgPath: MINING },
  { key: 'conveyor', label: 'Convoyeur', category: 'industrie', svgPath: CONVEYOR },
  {
    key: 'silo-industrial',
    label: 'Silo industriel',
    category: 'industrie',
    svgPath: SILO_INDUSTRIAL,
  },
  { key: 'chimney', label: 'Cheminée industrielle', category: 'industrie', svgPath: CHIMNEY },
  // Humanitaire
  { key: 'aid-box', label: "Kit d'aide", category: 'humanitaire', svgPath: AID_BOX },
  {
    key: 'refugee-tent',
    label: 'Camp de réfugiés',
    category: 'humanitaire',
    svgPath: REFUGEE_TENT,
  },
  {
    key: 'red-cross-tent',
    label: "Tente médicale d'urgence",
    category: 'humanitaire',
    svgPath: RED_CROSS_TENT,
  },
  {
    key: 'water-truck',
    label: "Camion-citerne d'eau",
    category: 'humanitaire',
    svgPath: WATER_TRUCK,
  },
  {
    key: 'food-distribution',
    label: 'Distribution alimentaire',
    category: 'humanitaire',
    svgPath: FOOD_DISTRIBUTION,
  },
  { key: 'ngo-flag', label: 'ONG', category: 'humanitaire', svgPath: NGO_FLAG },
  {
    key: 'first-aid-kit',
    label: 'Trousse de secours',
    category: 'humanitaire',
    svgPath: FIRST_AID_KIT,
  },
  { key: 'blanket', label: 'Aide matérielle', category: 'humanitaire', svgPath: BLANKET },
  // Religion
  { key: 'mosque', label: 'Mosquée', category: 'religion', svgPath: MOSQUE },
  { key: 'church', label: 'Église', category: 'religion', svgPath: CHURCH },
  { key: 'temple', label: 'Temple', category: 'religion', svgPath: TEMPLE },
  { key: 'synagogue', label: 'Synagogue', category: 'religion', svgPath: SYNAGOGUE },
  { key: 'pagoda', label: 'Pagode', category: 'religion', svgPath: PAGODA },
  { key: 'shrine', label: 'Sanctuaire', category: 'religion', svgPath: SHRINE },
  // Tourisme et nature
  { key: 'waterfall', label: "Chute d'eau", category: 'tourisme', svgPath: WATERFALL },
  { key: 'cave', label: 'Grotte', category: 'tourisme', svgPath: CAVE },
  { key: 'beach', label: 'Plage', category: 'tourisme', svgPath: BEACH },
  {
    key: 'hiking-trail',
    label: 'Sentier de randonnée',
    category: 'tourisme',
    svgPath: HIKING_TRAIL,
  },
  {
    key: 'national-park-gate',
    label: 'Entrée de parc national',
    category: 'tourisme',
    svgPath: NATIONAL_PARK_GATE,
  },
  { key: 'safari', label: 'Safari', category: 'tourisme', svgPath: SAFARI },
  { key: 'hot-spring', label: 'Source chaude', category: 'tourisme', svgPath: HOT_SPRING },
  { key: 'canyon', label: 'Canyon', category: 'tourisme', svgPath: CANYON },
  { key: 'island', label: 'Île', category: 'tourisme', svgPath: ISLAND },
  { key: 'lighthouse', label: 'Phare', category: 'tourisme', svgPath: LIGHTHOUSE },
  // Services publics
  {
    key: 'post-office',
    label: 'Bureau de poste',
    category: 'services-publics',
    svgPath: POST_OFFICE,
  },
  { key: 'voting-box', label: 'Bureau de vote', category: 'services-publics', svgPath: VOTING_BOX },
  {
    key: 'civil-registry',
    label: 'État civil',
    category: 'services-publics',
    svgPath: CIVIL_REGISTRY,
  },
  { key: 'customs', label: 'Douane', category: 'services-publics', svgPath: CUSTOMS },
  { key: 'embassy', label: 'Ambassade/Consulat', category: 'services-publics', svgPath: EMBASSY },
  { key: 'city-hall', label: 'Hôtel de ville', category: 'services-publics', svgPath: CITY_HALL },
  { key: 'archive', label: 'Archives', category: 'services-publics', svgPath: ARCHIVE },
  { key: 'notary', label: 'Notaire', category: 'services-publics', svgPath: NOTARY },
  // Télécommunications
  {
    key: 'cell-tower',
    label: 'Pylône télécom',
    category: 'telecommunications',
    svgPath: CELL_TOWER,
  },
  {
    key: 'fiber-cable',
    label: 'Fibre optique',
    category: 'telecommunications',
    svgPath: FIBER_CABLE,
  },
  { key: 'radio-tower', label: 'Tour radio', category: 'telecommunications', svgPath: RADIO_TOWER },
  {
    key: 'tv-tower',
    label: 'Tour de télévision',
    category: 'telecommunications',
    svgPath: TV_TOWER,
  },
  { key: 'satellite', label: 'Satellite', category: 'telecommunications', svgPath: SATELLITE },
  {
    key: 'broadcast',
    label: 'Diffusion/Réseau',
    category: 'telecommunications',
    svgPath: BROADCAST,
  },
  // Urbanisme
  { key: 'street-light', label: 'Éclairage public', category: 'urbanisme', svgPath: STREET_LIGHT },
  {
    key: 'traffic-light',
    label: 'Feu de circulation',
    category: 'urbanisme',
    svgPath: TRAFFIC_LIGHT,
  },
  { key: 'road-sign', label: 'Signalisation routière', category: 'urbanisme', svgPath: ROAD_SIGN },
  { key: 'roundabout', label: 'Rond-point', category: 'urbanisme', svgPath: ROUNDABOUT },
  {
    key: 'pedestrian-crossing',
    label: 'Passage piéton',
    category: 'urbanisme',
    svgPath: PEDESTRIAN_CROSSING,
  },
  { key: 'sidewalk', label: 'Trottoir', category: 'urbanisme', svgPath: SIDEWALK },
  { key: 'sewer-cover', label: "Regard d'égout", category: 'urbanisme', svgPath: SEWER_COVER },
  { key: 'manhole', label: "Bouche d'accès", category: 'urbanisme', svgPath: MANHOLE },
  { key: 'bench', label: 'Mobilier urbain', category: 'urbanisme', svgPath: BENCH },
  { key: 'bus-stop', label: 'Arrêt de bus', category: 'urbanisme', svgPath: BUS_STOP },
  // Météo
  { key: 'sun', label: 'Ensoleillé', category: 'meteo', svgPath: SUN },
  { key: 'rain', label: 'Pluie', category: 'meteo', svgPath: RAIN },
  { key: 'cloud', label: 'Nuageux', category: 'meteo', svgPath: CLOUD },
  { key: 'thermometer', label: 'Température', category: 'meteo', svgPath: THERMOMETER },
  { key: 'wind', label: 'Vent', category: 'meteo', svgPath: WIND },
  { key: 'storm', label: 'Tempête', category: 'meteo', svgPath: STORM },
  // Véhicules spécialisés
  { key: 'fire-truck', label: 'Camion de pompiers', category: 'vehicules', svgPath: FIRE_TRUCK },
  { key: 'tanker-truck', label: 'Camion-citerne', category: 'vehicules', svgPath: TANKER_TRUCK },
  { key: 'tram', label: 'Tramway', category: 'vehicules', svgPath: TRAM },
  { key: 'scooter', label: 'Scooter', category: 'vehicules', svgPath: SCOOTER },
  { key: 'cable-car', label: 'Téléphérique', category: 'vehicules', svgPath: CABLE_CAR },
  { key: 'pickup-truck', label: 'Camionnette', category: 'vehicules', svgPath: PICKUP_TRUCK },
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
