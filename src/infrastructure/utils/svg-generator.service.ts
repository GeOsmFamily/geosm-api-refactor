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
}

export class SvgGeneratorService {
  generateSvg(options: SvgOptions): string {
    const { color, shape, size, strokeColor = '#000000', strokeWidth = 1, label } = options;
    const half = size / 2;

    let shapeElement: string;
    switch (shape) {
      case 'circle':
        shapeElement = `<circle cx="${half}" cy="${half}" r="${half - strokeWidth}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
      case 'square':
        shapeElement = `<rect x="${strokeWidth}" y="${strokeWidth}" width="${size - strokeWidth * 2}" height="${size - strokeWidth * 2}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
      case 'triangle': {
        const points = `${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}`;
        shapeElement = `<polygon points="${points}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
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
        shapeElement = `<polygon points="${pts.join(' ')}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
      }
      case 'pin':
        shapeElement = `<path d="M${half} ${size - strokeWidth} C${half} ${size - strokeWidth} ${size - strokeWidth} ${half + 4} ${size - strokeWidth} ${half - 2} C${size - strokeWidth} ${strokeWidth + 4} ${half + 6} ${strokeWidth} ${half} ${strokeWidth} C${half - 6} ${strokeWidth} ${strokeWidth} ${strokeWidth + 4} ${strokeWidth} ${half - 2} C${strokeWidth} ${half + 4} ${half} ${size - strokeWidth} ${half} ${size - strokeWidth} Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        break;
    }

    let labelElement = '';
    if (label) {
      const innerIcon = getInnerIconPath(label);
      if (innerIcon) {
        labelElement = innerIcon;
      } else {
        labelElement = `<text x="${half}" y="${half + 4}" text-anchor="middle" font-size="${Math.max(8, size / 3)}" fill="${strokeColor}" font-family="Arial">${label}</text>`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shapeElement}${labelElement}</svg>`;
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

function getInnerIconPath(label: string): string | null {
  switch (label) {
    // Health (Cross)
    case 'H':
    case 'CS':
    case 'IM':
    case 'MA':
    case 'NU':
      return `<path d="M9 14h14v4H9z M14 9h4v14h-4z" fill="#ffffff"/>`;

    // Education (Graduation Cap)
    case 'EP':
    case 'EM':
    case 'UN':
    case 'BU':
    case 'CF':
      return `<path d="M16 9l8 4-8 4-8-4z M10 15v3c0 1.5 2.7 2.5 6 2.5s6-1 6-2.5v-3 M21 13v4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

    // Finance (Bank)
    case 'AT':
    case 'MF':
    case 'BF':
    case 'CE':
    case 'MM':
      return `<path d="M16 8l9 4H7z M8 12h16v1.5H8z M10 13.5v6.5h2v-6.5zm4 0v6.5h2v-6.5zm4 0v6.5h2v-6.5z M7 20h18v2.5H7z" fill="#ffffff"/>`;

    // Environment/Nature (Tree)
    case 'EV':
    case 'RN':
    case 'GD':
    case 'SE':
    case 'QA':
      return `<path d="M16 8l5 5h-3.5l4.5 5h-12l4.5-5H11z M14.5 18h3v5h-3z" fill="#ffffff"/>`;

    // Transports (Air, Port, Train, Bus, Car)
    case 'AE':
      return `<path d="M16 8l1.5 5.5L23 15v1.5l-5.5-1L16 21l2 2v1h-4v-1l2-2-1.5-5.5-5.5 1V15l5.5-1.5L16 8z" fill="#ffffff"/>`;
    case 'PT':
      return `<path d="M16 9v9 M12 13h8 M10 15c0 3.3 2.7 6 6 6s6-2.7 6-6 M16 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
    case 'GF':
      return `<path d="M10 9h12v9H10zm0 9l-2 2v1h16v-1l-2-2 M12 15h8" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
    case 'BS':
      return `<path d="M9 9h14v9H9zm3 3h8v3h-8z M12 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
    case 'LV':
      return `<path d="M8 14h16v4H8zm2-2.5l2.5-3.5h7l2.5 3.5z M10 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm12 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;

    // Administration (Shield, Justice)
    case 'PO':
      return `<path d="M16 9c3.5 0 5.5-1 5.5-1s1.5 3 1.5 6.5c0 4-7 6.5-7 6.5s-7-2.5-7-6.5c0-3.5 1.5-6.5 1.5-6.5s3.5 1 5.5 1z" fill="#ffffff"/>`;
    case 'TR':
      return `<path d="M16 9v13M10 12h12M10 12l-2 5h4zM20 12l-2 5h4z M12 22h8" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;
    case 'PR':
    case 'SI':
      return `<path d="M9 9h14v12H9zm2 3h10 M12 17h8" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;

    // Restauration (Knife/Fork)
    case 'PB':
    case 'FT':
    case 'BC':
    case 'CV':
      return `<path d="M11 9v5 M10 9v3h2v-3 M12 9v3 M18 9v11 M18 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;

    // Accommodation (Bed/Tent)
    case 'RM':
    case 'CH':
    case 'AJ':
    case 'MO':
      return `<path d="M8 10v12 M8 15h16 M24 10v12 M11 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
    case 'CA':
      return `<path d="M16 8l10 12H6z M16 8v12" stroke="#ffffff" stroke-width="1.5" fill="none"/>`;

    // Default (Shopping Bag)
    default:
      return `<path d="M10 12h12v8H10zm3-3a3 3 0 0 1 6 0" stroke="#ffffff" stroke-width="1.8" fill="none"/>`;
  }
}
