import { v4 as uuidv4 } from 'uuid';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { OsmQueryService, CreateOsmTableOptions } from '../../../infrastructure/database/osm-query.service.js';
import { CreateInstanceDTO } from '../../dtos/instance.dto.js';
import { Instance } from '../../../domain/entities/instance.entity.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { defaultCategories, defaultLayers } from '../../../domain/constants/default-layers.constants.js';
import { logger } from '../../../infrastructure/observability/logger.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { SvgGeneratorService } from '../../../infrastructure/utils/svg-generator.service.js';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { config } from '../../../config/env.config.js';

// Mapping from layer slug to custom SVG shape and short label
const LAYER_SVG_CONFIG: Record<string, { shape: 'circle' | 'square' | 'triangle' | 'star' | 'pin'; label: string }> = {
  // Santé
  'hopitaux':                          { shape: 'pin',      label: 'H'  },
  'centres-de-sante-dispensaires':     { shape: 'pin',      label: 'CS' },
  'imagerie-medicale-radiologie':      { shape: 'circle',   label: 'IM' },
  'maternite-sage-femme':              { shape: 'circle',   label: 'MA' },
  'nutrition-dietetique':              { shape: 'circle',   label: 'NU' },
  // Éducation
  'ecole-primaire':                    { shape: 'square',   label: 'EP' },
  'ecole-maternelle':                  { shape: 'square',   label: 'EM' },
  'universite-enseignement-superieur': { shape: 'square',   label: 'UN' },
  'bibliotheque-universitaire':        { shape: 'square',   label: 'BU' },
  'centre-formation-professionnelle':  { shape: 'square',   label: 'CF' },
  // Finance
  'atm-distributeurs':                 { shape: 'star',     label: 'AT' },
  'microfinance':                      { shape: 'star',     label: 'MF' },
  'bourse-marche-financier':           { shape: 'star',     label: 'BF' },
  'cooperative-epargne-credit':        { shape: 'star',     label: 'CE' },
  'mobile-money':                      { shape: 'star',     label: 'MM' },
  // Environnement
  'espaces-verts-parcs':               { shape: 'triangle', label: 'EV' },
  'gestion-dechets-recyclage':         { shape: 'triangle', label: 'GD' },
  'stations-epuration':                { shape: 'triangle', label: 'SE' },
  'reserves-naturelles-aires-protegees':{ shape: 'triangle', label: 'RN' },
  'qualite-air-stations':              { shape: 'triangle', label: 'QA' },
  // Commerce
  'librairie':                         { shape: 'circle',   label: 'LI' },
  'marche-local':                      { shape: 'circle',   label: 'ML' },
  'animalerie':                        { shape: 'circle',   label: 'AN' },
  'cordonnerie':                       { shape: 'circle',   label: 'CO' },
  'magasin-bio':                       { shape: 'circle',   label: 'BIO'},
  // Restauration
  'pub-brasserie':                     { shape: 'pin',      label: 'PB' },
  'food-truck':                        { shape: 'pin',      label: 'FT' },
  'traiteur-evenementiel':             { shape: 'pin',      label: 'TR' },
  'bar-chicha-lounge':                 { shape: 'pin',      label: 'BC' },
  'cave-a-vin':                        { shape: 'pin',      label: 'CV' },
  // Hébergement
  'residence-meublee-apparthotel':     { shape: 'square',   label: 'RM' },
  'chambre-dhotes':                    { shape: 'square',   label: 'CH' },
  'auberge-jeunesse':                  { shape: 'square',   label: 'AJ' },
  'camping':                           { shape: 'triangle', label: 'CA' },
  'motel':                             { shape: 'square',   label: 'MO' },
  // Loisirs
  'parc-attractions':                  { shape: 'star',     label: 'PA' },
  'zoo-parc-animalier':                { shape: 'star',     label: 'ZO' },
  'piscine-publique':                  { shape: 'star',     label: 'PI' },
  'terrain-sport-stade':               { shape: 'star',     label: 'ST' },
  'aire-jeux-enfants':                 { shape: 'star',     label: 'AJ' },
  // Administration
  'mairies-communes':                  { shape: 'pin',      label: 'MA' },
  'tribunaux':                         { shape: 'pin',      label: 'TR' },
  'police-gendarmerie':                { shape: 'pin',      label: 'PO' },
  'prefectures':                       { shape: 'pin',      label: 'PR' },
  'services-impots':                   { shape: 'pin',      label: 'SI' },
  // Transport
  'gare-routiere-bus':                 { shape: 'circle',   label: 'BS' },
  'aeroport':                          { shape: 'triangle', label: 'AE' },
  'port-embarcadere':                  { shape: 'circle',   label: 'PT' },
  'gare-ferroviaire':                  { shape: 'circle',   label: 'GF' },
  'location-vehicules':                { shape: 'circle',   label: 'LV' },
};

export class CreateInstanceUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly subGroupRepository: ISubGroupRepository,
    private readonly layerRepository: ILayerRepository,
    private readonly osmQueryService: OsmQueryService,
    private readonly qgisProjectService: QGISProjectService,
    private readonly svgGeneratorService: SvgGeneratorService,
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(dto: CreateInstanceDTO): Promise<Instance> {
    const slug = Slug.create(dto.slug);
    const existing = await this.instanceRepository.findBySlug(slug.value);
    if (existing) throw new ConflictError('Instance with this slug already exists');

    const instance = await this.instanceRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: slug.value,
      description: dto.description ?? null,
      logo: dto.logo ?? null,
      bbox: dto.bbox ?? null,
      centerLat: dto.centerLat ?? null,
      centerLon: dto.centerLon ?? null,
      defaultZoom: dto.defaultZoom ?? 6,
      boundaryTable: dto.boundaryTable ?? null,
      boundaryId: dto.boundaryId ?? null,
      boundaryGeomCol: dto.boundaryGeomCol ?? null,
      adminLevel: dto.adminLevel ?? null,
      parentInstanceId: dto.parentInstanceId ?? null,
      isActive: true,
    });

    // Déclencher l'initialisation asynchrone des thématiques et données OSM
    this.initializeInstanceData(
      instance.id,
      instance.slug,
      instance.bbox,
      instance.boundaryTable,
      instance.boundaryId,
      instance.boundaryGeomCol,
    ).catch((err) => {
      const error = err as Error;
      logger.error('Erreur lors de l\'initialisation des couches par défaut', {
        instanceSlug: instance.slug,
        error: error?.message || String(err),
      });
    });

    return instance;
  }

  public async initializeInstanceData(
    instanceId: string,
    instanceSlug: string,
    bbox: number[] | null,
    boundaryTable: string | null,
    boundaryId: number | null,
    boundaryGeomCol: string | null,
  ): Promise<void> {
    logger.info('Début de l\'initialisation des couches par défaut', { instanceId, instanceSlug });

    // ─── Étape 1 : Création du projet QGIS en DB et préparation du fichier ────
    const qgisProjectId = uuidv4();
    const projectFilePath = this.qgisProjectService.getProjectPath(instanceSlug);
    await this.qgisProjectService.ensureProjectDir(instanceSlug);

    const qgisProject = await this.qgisProjectRepository.create({
      id: qgisProjectId,
      name: `${instanceSlug}-project`,
      filePath: projectFilePath,
      description: `QGIS project for instance ${instanceSlug}`,
      instanceId,
    });
    logger.info('Projet QGIS créé en BD', { qgisProjectId, projectFilePath });

    // ─── Étape 2 : Création de toutes les thématiques (Groupes) ───────────────
    const createdGroups = new Map<number, string>(); // categoryId -> groupId

    for (const cat of defaultCategories) {
      const groupSlug = `${instanceSlug}-${cat.slug}`;
      const group = await this.groupRepository.create({
        id: uuidv4(),
        name: JSON.stringify(cat.name),
        slug: groupSlug,
        description: null,
        icon: cat.icon,
        color: cat.color,
        order: cat.order,
        isActive: true,
        instanceId,
      });
      createdGroups.set(cat.id, group.id);
      logger.debug('Groupe créé pour l\'instance', { groupSlug, groupId: group.id });
    }

    // ─── Étape 3 : Création des sous-thématiques (Sous-Groupes) par défaut ───
    const createdSubGroups = new Map<number, string>(); // categoryId -> subGroupId

    for (const cat of defaultCategories) {
      const groupId = createdGroups.get(cat.id) ?? '';
      const subGroupSlug = `${instanceSlug}-${cat.slug}-default`;
      const subGroupName = {
        fr: `${cat.name.fr} - Général`,
        en: `${cat.name.en} - General`,
      };

      const subGroup = await this.subGroupRepository.create({
        id: uuidv4(),
        name: JSON.stringify(subGroupName),
        slug: subGroupSlug,
        description: null,
        icon: null,
        order: 1,
        isActive: true,
        groupId,
      });
      createdSubGroups.set(cat.id, subGroup.id);
      logger.debug('Sous-groupe par défaut créé pour le groupe', { subGroupSlug, subGroupId: subGroup.id });
    }

    // ─── Étape 4 : Création des couches, import OSM, SVG et QGIS layer ───────
    for (const layerConfig of defaultLayers) {
      const subGroupId = createdSubGroups.get(layerConfig.categoryId) ?? '';
      const layerSlug = `${instanceSlug}-${layerConfig.slug}`;
      const dbTableName = `${instanceSlug}_${layerConfig.slug}`.replace(/\W/g, '');

      // Récupérer la catégorie pour icône et couleur
      const category = defaultCategories.find(c => c.id === layerConfig.categoryId);
      const categoryColor = category?.color ?? '#00ada7';

      // ── a) Générer l'icône SVG personnalisée ──────────────────────────────
      const svgConf = LAYER_SVG_CONFIG[layerConfig.slug] ?? { shape: 'circle' as const, label: layerConfig.slug.substring(0, 2).toUpperCase() };
      const svgContent = this.svgGeneratorService.generateSvg({
        color: categoryColor,
        shape: svgConf.shape,
        size: 32,
        strokeColor: '#ffffff',
        strokeWidth: 2,
        label: svgConf.label,
      });

      // Chemin dans le volume partagé (accessible par QGIS Server et l'API)
      const svgQgisPath = `${config.QGIS_PROJECTS_DIR}/icons/${layerConfig.slug}.svg`;
      const svgAssetRelPath = `api/v1/layers/icons/${layerConfig.slug}.svg`;

      try {
        await this.svgGeneratorService.saveSvgToFile(svgContent, svgQgisPath);
      } catch (svgErr) {
        logger.warn('Échec sauvegarde SVG', { slug: layerConfig.slug, error: String(svgErr) });
      }

      // ── b) Créer l'enregistrement de la couche en base ───────────────────
      const layer = await this.layerRepository.create({
        id: uuidv4(),
        name: JSON.stringify(layerConfig.name),
        slug: layerSlug,
        description: null,
        geometryType: layerConfig.geometryType,
        sourceType: SourceType.WMS,
        sourceUrl: `http://localhost:8380/ows?map=${projectFilePath}`,
        sourceLayer: `${instanceSlug}:${dbTableName}`,
        tableName: dbTableName,
        schemaName: instanceSlug,
        minZoom: 0,
        maxZoom: 22,
        isVisible: true,
        isQueryable: true,
        opacity: 1,
        order: 1,
        metadata: {
          icon: svgAssetRelPath,
          color: categoryColor,
          geometryType: layerConfig.geometryType,
        },
        subGroupId,
        instanceId,
        qgisProjectId: qgisProject.id,
      });

      logger.debug('Couche créée en BDD', { layerSlug, layerId: layer.id });

      // ── c) Créer la table spatiale OSM ──────────────────────────────────
      let sourceTable: 'planet_osm_point' | 'planet_osm_line' | 'planet_osm_polygon' = 'planet_osm_point';
      if (layerConfig.geometryType === GeometryType.POLYGON) {
        sourceTable = 'planet_osm_polygon';
      } else if (layerConfig.geometryType === GeometryType.LINESTRING) {
        sourceTable = 'planet_osm_line';
      }

      const conditions = layerConfig.tagsOsm.split(';').map((part) => {
        const [key, value] = part.split('=');
        return { key: key.trim(), value: (value ?? '*').trim() };
      });

      const osmOptions: CreateOsmTableOptions = {
        schema: instanceSlug,
        table: dbTableName,
        sourceTable,
        conditions,
      };

      if (boundaryTable && boundaryId != null) {
        osmOptions.boundaryTable = boundaryTable;
        osmOptions.boundaryId = boundaryId;
        osmOptions.boundaryGeomColumn = boundaryGeomCol ?? 'geom';
      } else if (bbox && bbox.length === 4) {
        osmOptions.bbox = bbox as [number, number, number, number];
      }

      try {
        const stats = await this.osmQueryService.createTable(osmOptions);
        logger.info('Table spatiale créée avec succès', { layerSlug, tableName: dbTableName, stats });

        // Mettre à jour les métadonnées avec les statistiques
        await this.layerRepository.update(layer.id, {
          metadata: {
            icon: svgAssetRelPath,
            color: categoryColor,
            geometryType: layerConfig.geometryType,
            featureCount: stats.count,
            totalArea: stats.totalArea,
            totalLength: stats.totalLength,
            importedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        const error = err as Error;
        logger.error('Échec de la création de la table spatiale', {
          layerSlug,
          tableName: dbTableName,
          error: error?.message || String(err),
        });
      }

      // ── d) Ajouter la couche au projet QGIS ──────────────────────────────
      // Extraire le type QGIS de la couche
      let qgisGeomType = 'POINT';
      if (layerConfig.geometryType === GeometryType.POLYGON) {
        qgisGeomType = 'MULTIPOLYGON';
      } else if (layerConfig.geometryType === GeometryType.LINESTRING) {
        qgisGeomType = 'LINESTRING';
      }

      // URI de connexion postgres natif compatible avec le provider QGIS
      // Les identifiants sont lus depuis les variables d'env pour ne pas les coder en dur
      const dbUrl = new URL(config.DATABASE_URL);
      const pgUri = [
        `dbname='${dbUrl.pathname.replace('/', '')}'`,
        `host='${dbUrl.hostname}'`,
        `port='${dbUrl.port || '5432'}'`,
        `user='${dbUrl.username}'`,
        `password='${dbUrl.password}'`,
        `sslmode=disable`,
        `key='osm_id'`,
        `srid=4326`,
        `type=${qgisGeomType}`,
        `table="${instanceSlug}"."${dbTableName}"`,
        `(geom)`,
      ].join(' ');

      try {
        const qgisResult = await this.qgisProjectService.addVectorLayer(
          projectFilePath,
          pgUri,
          dbTableName,
          { iconPath: svgQgisPath, iconColor: categoryColor },
        );
        if (qgisResult.success) {
          logger.debug('Couche ajoutée au projet QGIS', { layerSlug });
        } else {
          logger.warn('QGIS addVectorLayer a échoué', { layerSlug, error: qgisResult.error });
        }
      } catch (qErr) {
        logger.warn('Exception QGIS addVectorLayer', { layerSlug, error: String(qErr) });
      }
    }

    // ─── Étape 5 : Configurer les capacités WMS du projet ─────────────────
    try {
      await this.qgisProjectService.setupWMSCapabilities(projectFilePath, {
        title: `GeOSM - ${instanceSlug}`,
        abstract: `Couches thématiques pour l'instance ${instanceSlug}`,
        organization: 'GeOSM',
        crsList: ['EPSG:4326', 'EPSG:3857'],
      });
      logger.info('Capacités WMS configurées', { instanceSlug });
    } catch (wmsErr) {
      logger.warn('Échec de la configuration WMS', { error: String(wmsErr) });
    }

    logger.info('Initialisation des couches par défaut terminée', { instanceId, instanceSlug });
  }
}
