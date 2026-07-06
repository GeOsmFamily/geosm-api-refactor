import { SvgGeneratorService, SvgOptions } from '../../../infrastructure/utils/svg-generator.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GenerateIconUseCase');

export class GenerateIconUseCase {
  constructor(private readonly svgGeneratorService: SvgGeneratorService) {}

  async execute(options: SvgOptions | SvgOptions[]): Promise<{ svgs: string[] }> {
    const count = Array.isArray(options) ? options.length : 1;
    logger.debug('Generating icon SVG(s)', { count });
    if (Array.isArray(options)) {
      return { svgs: this.svgGeneratorService.generateMultipleSvg(options) };
    }
    return { svgs: [this.svgGeneratorService.generateSvg(options)] };
  }
}
