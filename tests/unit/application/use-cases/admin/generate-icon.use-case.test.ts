import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateIconUseCase } from '../../../../../src/application/use-cases/admin/generate-icon.use-case.js';

describe('GenerateIconUseCase', () => {
  let useCase: GenerateIconUseCase;
  let svgGeneratorService: { generateSvg: ReturnType<typeof vi.fn>; generateMultipleSvg: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    svgGeneratorService = {
      generateSvg: vi.fn().mockReturnValue('<svg>single</svg>'),
      generateMultipleSvg: vi.fn().mockReturnValue(['<svg>a</svg>', '<svg>b</svg>']),
    };
    useCase = new GenerateIconUseCase(svgGeneratorService as any);
  });

  it('should generate a single SVG icon', async () => {
    const options = { shape: 'circle', color: '#FF0000' };
    const result = await useCase.execute(options as any);
    expect(result.svgs).toEqual(['<svg>single</svg>']);
    expect(svgGeneratorService.generateSvg).toHaveBeenCalledWith(options);
  });

  it('should generate multiple SVG icons for array input', async () => {
    const options = [{ shape: 'circle', color: '#FF0000' }, { shape: 'square', color: '#00FF00' }];
    const result = await useCase.execute(options as any);
    expect(result.svgs).toEqual(['<svg>a</svg>', '<svg>b</svg>']);
    expect(svgGeneratorService.generateMultipleSvg).toHaveBeenCalledWith(options);
  });
});
