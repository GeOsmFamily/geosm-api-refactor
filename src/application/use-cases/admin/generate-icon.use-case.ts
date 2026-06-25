import { SvgGeneratorService, SvgOptions } from '../../../infrastructure/utils/svg-generator.service.js';

export class GenerateIconUseCase {
  constructor(private readonly svgGeneratorService: SvgGeneratorService) {}

  async execute(options: SvgOptions | SvgOptions[]): Promise<{ svgs: string[] }> {
    if (Array.isArray(options)) {
      return { svgs: this.svgGeneratorService.generateMultipleSvg(options) };
    }
    return { svgs: [this.svgGeneratorService.generateSvg(options)] };
  }
}
