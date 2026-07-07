import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisServerService } from '../../../infrastructure/external-apis/qgis-server.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface QgisProjectLayerInfo {
  name: string;
  title: string;
}

/**
 * Énumère les couches d'un projet QGIS (uploadé ou par défaut) via le GetCapabilities WMS du
 * serveur QGIS déjà en place - évite d'avoir à parser le format binaire/XML .qgs/.qgz à la main
 * (voir recherche : QgisServerService.getCapabilities() suffit).
 */
export class ListQgisProjectLayersUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
    private readonly qgisServerService: QgisServerService,
  ) {}

  async execute(qgisProjectId: string): Promise<QgisProjectLayerInfo[]> {
    const project = await this.qgisProjectRepository.findById(qgisProjectId);
    if (!project) throw new NotFoundError('QgisProject', qgisProjectId);

    const xml = await this.qgisServerService.getCapabilities(project.filePath, 'WMS');
    return this.parseLayerNames(xml);
  }

  /**
   * Extraction volontairement simple (regex, pas de dépendance XML) : dans le GetCapabilities
   * WMS 1.3.0 généré par QGIS Server, seules les couches de données réelles portent un élément
   * <Name> (la couche racine du projet n'en a pas) - on ignore aussi le <Name>WMS</Name> du bloc
   * <Service> en ne cherchant qu'à partir de <Capability>.
   */
  private parseLayerNames(xml: string): QgisProjectLayerInfo[] {
    const capabilityIndex = xml.indexOf('<Capability');
    const searchZone = capabilityIndex >= 0 ? xml.slice(capabilityIndex) : xml;

    const layers: QgisProjectLayerInfo[] = [];
    const layerBlockRegex = /<Layer\b[^>]*>\s*<Name>([^<]+)<\/Name>\s*<Title>([^<]*)<\/Title>/g;
    let match: RegExpExecArray | null;
    while ((match = layerBlockRegex.exec(searchZone)) !== null) {
      layers.push({ name: match[1].trim(), title: match[2].trim() || match[1].trim() });
    }
    return layers;
  }
}
