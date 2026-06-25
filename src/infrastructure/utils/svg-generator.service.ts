import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

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
      labelElement = `<text x="${half}" y="${half + 4}" text-anchor="middle" font-size="${Math.max(8, size / 3)}" fill="${strokeColor}" font-family="Arial">${label}</text>`;
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
