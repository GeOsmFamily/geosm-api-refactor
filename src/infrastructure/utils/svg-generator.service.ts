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
    const { color, shape, size, strokeColor = '#000000', strokeWidth = 1, label, iconKey } = options;
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
    const highlightElement = highlightR > 4
      ? `<ellipse cx="${half}" cy="${half - highlightR * 0.45}" rx="${highlightR * 0.7}" ry="${highlightR * 0.35}" fill="#ffffff" opacity="0.16"/>`
      : '';

    let labelElement = '';
    const innerIcon = getInnerIconPath(iconKey, label);
    if (innerIcon) {
      labelElement = innerIcon;
    } else if (label) {
      labelElement = `<text x="${half}" y="${half + 4}" text-anchor="middle" font-size="${Math.max(8, size / 3)}" fill="${strokeColor}" font-family="Arial">${label}</text>`;
    }

    const canvasSize = size + pad * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">` +
      `<defs><filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.35"/>` +
      `</filter></defs>` +
      `<g transform="translate(${pad},${pad})" filter="url(#dropshadow)">${shapeElement}${highlightElement}${labelElement}</g>` +
      `</svg>`;
  }

  generateMultipleSvg(optionsList: SvgOptions[]): string[] {
    return optionsList.map(opts => this.generateSvg(opts));
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

/** Slug -> glyph, keyed by layer slug so two layers can never collide on a shared 2-letter label. */
const SLUG_ICON_GLYPHS: Record<string, string> = {
  // Santé
  'hopitaux': CROSS,
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
  'microfinance': BANK,
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
  'librairie': BOOK,
  'marche-local': BASKET,
  'animalerie': PAW,
  'cordonnerie': SHOE,
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
  'camping': TENT,
  'motel': BED,
  // Loisirs
  'parc-attractions': FERRIS_WHEEL,
  'zoo-parc-animalier': ANIMAL,
  'piscine-publique': WAVE,
  'terrain-sport-stade': BALL,
  'aire-jeux-enfants': SWING,
  // Administration et Institutions Publiques
  'mairies-communes': GOV_BUILDING,
  'tribunaux': SCALES,
  'police-gendarmerie': SHIELD,
  'prefectures': GOV_BUILDING,
  'services-impots': GOV_BUILDING,
  // Automobile et Transport
  'gare-routiere-bus': BUS,
  'aeroport': PLANE,
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

  switch (label) {
    case 'H': case 'CS': case 'IM': case 'MA': case 'NU':
      return CROSS;
    case 'EP': case 'EM': case 'UN': case 'BU': case 'CF':
      return GRAD_CAP;
    case 'AT': case 'MF': case 'BF': case 'CE': case 'MM':
      return BANK;
    case 'EV': case 'RN': case 'GD': case 'SE': case 'QA':
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
    case 'PR': case 'SI':
      return GOV_BUILDING;
    case 'PB': case 'FT': case 'BC': case 'CV':
      return FORK_KNIFE;
    case 'RM': case 'CH': case 'AJ': case 'MO':
      return BED;
    case 'CA':
      return TENT;
    default:
      return label ? DEFAULT_GLYPH : null;
  }
}
