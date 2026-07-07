import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { SvgGeneratorService, SvgOptions } from '../../../infrastructure/utils/svg-generator.service.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType } from '../../../domain/enums.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ApplyLayerStyleUseCase');

const POINT_TYPES = new Set([GeometryType.POINT, GeometryType.MULTIPOINT]);

export interface ApplyLayerStyleInput {
  layerId: string;
  mode: 'color-icon' | 'kml';
  color?: string;
  iconKey?: string;
  shape?: SvgOptions['shape'];
  kmlFilePath?: string;
}

/**
 * Applique un style réel (couleur + icône, ou style natif d'un KML importé) à une couche : pour
 * les couches ponctuelles, régénère le SVG d'icône et pilote le rendu cluster client via
 * Layer.metadata (voir map-layer.service.ts côté frontend) ET le rendu QGIS (au cas où la
 * couche serait aussi consultée en WMS/impression) ; pour les couches surfaciques/linéaires,
 * seul le style QGIS (QML embarqué dans le projet) compte, puisque leur rendu carte passe
 * exclusivement par des tuiles WMS.
 */
export class ApplyLayerStyleUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly qgisProjectRepository: IQgisProjectRepository,
    private readonly qgisProjectService: QGISProjectService,
    private readonly svgGeneratorService: SvgGeneratorService,
  ) {}

  async execute(input: ApplyLayerStyleInput): Promise<Layer> {
    const layer = await this.layerRepository.findById(input.layerId);
    if (!layer) throw new NotFoundError('Layer', input.layerId);

    const projectPath = await this.resolveProjectPath(layer);
    const wmsLayerName = layer.sourceLayer || layer.tableName;
    if (!wmsLayerName) {
      throw new ValidationError('Cette couche n\'a pas de couche QGIS associée (source sans table ni sourceLayer).', {});
    }

    if (input.mode === 'kml') {
      if (!input.kmlFilePath) throw new ValidationError('Fichier KML manquant.', {});
      const result = await this.qgisProjectService.importKmlStyle(projectPath, wmsLayerName, input.kmlFilePath);
      if (!result.success) {
        throw new ValidationError(`Échec de l'application du style KML: ${result.error}`, {});
      }
      return this.layerRepository.update(layer.id, {
        metadata: { ...(layer.metadata ?? {}), styleSource: 'kml', styledAt: new Date().toISOString() },
      });
    }

    if (!input.color) throw new ValidationError('Couleur manquante.', {});
    const metadataUpdate: Record<string, unknown> = { ...(layer.metadata ?? {}), color: input.color, styleSource: 'color-icon', styledAt: new Date().toISOString() };

    if (POINT_TYPES.has(layer.geometryType)) {
      const iconKey = input.iconKey ?? 'default';
      const shape = input.shape ?? 'circle';
      const svg = this.svgGeneratorService.generateSvg({ color: input.color, shape, size: 32, strokeColor: '#ffffff', strokeWidth: 2, iconKey });
      const iconFilePath = `${config.QGIS_PROJECTS_DIR}/icons/${layer.slug}.svg`;
      await this.svgGeneratorService.saveSvgToFile(svg, iconFilePath);

      const result = await this.qgisProjectService.setIconOnLayer(projectPath, wmsLayerName, iconFilePath, 8, input.color);
      if (!result.success) {
        logger.warn('setIconOnLayer a échoué (le style client-rendu reste appliqué)', { layerId: layer.id, error: result.error });
      }
      metadataUpdate.icon = `api/v1/layers/icons/${layer.slug}.svg`;
      metadataUpdate.iconKey = iconKey;
      metadataUpdate.shape = shape;
    } else {
      const result = await this.qgisProjectService.setFillStyle(projectPath, wmsLayerName, input.color);
      if (!result.success) {
        throw new ValidationError(`Échec de l'application du style: ${result.error}`, {});
      }
    }

    const updated = await this.layerRepository.update(layer.id, { metadata: metadataUpdate });
    logger.info('Style appliqué à la couche', { layerId: layer.id, mode: input.mode });
    return updated;
  }

  private async resolveProjectPath(layer: Layer): Promise<string> {
    if (layer.qgisProjectId) {
      const project = await this.qgisProjectRepository.findById(layer.qgisProjectId);
      if (project) return project.filePath;
    }
    const instance = await this.instanceRepository.findById(layer.instanceId);
    if (!instance) throw new NotFoundError('Instance', layer.instanceId);
    return this.qgisProjectService.getProjectPath(instance.slug);
  }
}
