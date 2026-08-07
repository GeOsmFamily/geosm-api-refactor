import type {
  GeminiService,
  GeminiFunctionDeclaration,
  GeminiMessage,
} from '../../../infrastructure/external-apis/gemini.service.js';
import type { SearchGeocodingUseCase } from '../geocoding/search-geocoding.use-case.js';
import type { SearchLayersUseCase } from '../search/search-layers.use-case.js';
import type { GetLayerStatsUseCase } from '../layers/get-layer-stats.use-case.js';
import type { SpatialAnalysisUseCase } from '../analysis/spatial-analysis.use-case.js';
import type { FindNearestFeatureUseCase } from '../routing/find-nearest-feature.use-case.js';
import type { CreateLocationPlanUseCase } from '../location-plans/create-location-plan.use-case.js';
import type { CountFeaturesInGeometryUseCase } from '../features/count-features-in-geometry.use-case.js';
import type { GetRasterStatsInGeometryUseCase } from '../rasters/get-raster-stats-in-geometry.use-case.js';
import type { SummarizeViewportUseCase } from '../geoportail/summarize-viewport.use-case.js';
import type { GenerateAnalysisReportUseCase } from '../reports/generate-analysis-report.use-case.js';
import type { TrackEventUseCase } from '../analytics/track-event.use-case.js';
import type { GetLayerRecommendationsUseCase } from '../search/get-layer-recommendations.use-case.js';
import type { GetSearchSuggestionsUseCase } from '../search/get-search-suggestions.use-case.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type {
  PrismaAssistantConversationRepository,
  AssistantMessageRecord,
} from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { localize } from '../../utils/localize.js';
import { logger } from '../../../infrastructure/observability/logger.js';

/** Contexte carte ambiant, envoyé par le frontend à CHAQUE message (pas un paramètre que
 * Gemini remplit - il ne connaît pas la vue courante) - voir plan "refonte Statistiques" du
 * 2026-08-05, section agent IA. Consommé par l'outil `analyze_map_context`. */
export interface AssistantMapContext {
  extent?: [number, number, number, number];
  activeLayers?: { id: string; name: string }[];
}

/** Résultat compact d'un `compute_geometry`, persisté sur la conversation (voir
 * AssistantConversation.geometryCache) - évite de faire recopier par Gemini des coordonnées
 * complètes d'un appel à l'autre ou d'un message à l'autre (coûteux en tokens, source d'erreurs
 * de recopie sur une géométrie complexe) : les outils suivants référencent juste le label. */
interface CachedGeometry {
  geometry: Record<string, unknown>;
  summary: string;
}

export interface AssistantClientAction {
  action: 'activateLayer' | 'deactivateLayer' | 'zoomTo' | 'displayGeometry';
  [key: string]: unknown;
}

export interface AssistantAttachment {
  type: 'location-plan' | 'analysis-report';
  id: string;
  title: string;
  status: string;
  downloadUrl?: string;
}

/** Couche(s) réellement interrogée(s) pour produire une réponse - traçabilité contre
 * l'hallucination (voir demande du 2026-08-06 "chat expert cadastre/urbanisme"). Alimenté
 * uniquement par les outils qui lisent vraiment des données d'une couche (stats, comptage,
 * analyse croisée...), jamais par de simples outils de recherche/navigation (search_layers,
 * geocode) qui ne sont pas eux-mêmes la source d'une affirmation factuelle. */
export interface AssistantSourceRef {
  layerId: string;
  layerName: string;
}

export interface AssistantChatResult {
  conversationId: string;
  reply: string;
  clientActions: AssistantClientAction[];
  attachments: AssistantAttachment[];
  sources: AssistantSourceRef[];
}

interface DataToolResult {
  data: unknown;
  clientAction?: AssistantClientAction;
  attachment?: AssistantAttachment;
  source?: AssistantSourceRef[];
}

// Outils que Gemini peut choisir d'appeler - deux catégories : les outils "données" sont
// exécutés directement par le backend (réutilisent les use-cases existants, avec les mêmes
// garanties/erreurs que les routes REST correspondantes) ; les outils "action client" ne
// sont PAS exécutables côté serveur (activer/désactiver une couche, zoomer - voir
// MapLayerService/MapService dans le frontend) - le backend se contente de les collecter
// dans `clientActions` pour que le frontend les rejoue lui-même. Certains outils "données"
// (buffer_around_point, create_location_plan) émettent EUX AUSSI une clientAction/pièce
// jointe en plus de leur résultat texte - voir executeDataTool.
const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'geocode',
    description:
      "Trouve les coordonnées géographiques (latitude/longitude) d'un lieu nommé (ville, quartier, adresse...).",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Le nom du lieu à rechercher, ex: "Douala"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_layers',
    description:
      'Recherche des couches cartographiques disponibles sur le géoportail par mot-clé (ex: "hôpitaux", "écoles").',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Le terme de recherche' } },
      required: ['query'],
    },
  },
  {
    name: 'get_layer_stats',
    description:
      "Obtient les statistiques (nombre d'entités, superficie, longueur) d'une couche à partir de son identifiant.",
    parameters: {
      type: 'OBJECT',
      properties: { layerId: { type: 'STRING', description: 'Identifiant UUID de la couche' } },
      required: ['layerId'],
    },
  },
  {
    name: 'buffer_around_point',
    description:
      'Calcule une zone tampon (cercle) autour d\'un point et l\'affiche sur la carte, pour des requêtes comme "à moins de 5km de X".',
    parameters: {
      type: 'OBJECT',
      properties: {
        lon: { type: 'NUMBER', description: 'Longitude du point central' },
        lat: { type: 'NUMBER', description: 'Latitude du point central' },
        distanceMeters: { type: 'NUMBER', description: 'Rayon de la zone tampon en mètres' },
      },
      required: ['lon', 'lat', 'distanceMeters'],
    },
  },
  {
    name: 'find_nearest_feature',
    description:
      "Trouve les entités d'une couche les plus proches d'un point, classées par distance routière réelle.",
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche' },
        lon: { type: 'NUMBER' },
        lat: { type: 'NUMBER' },
        limit: { type: 'NUMBER', description: 'Nombre de résultats souhaités (défaut 3)' },
      },
      required: ['layerId', 'lon', 'lat'],
    },
  },
  {
    name: 'create_location_plan',
    description:
      'Génère un plan de localisation professionnel en PDF pour un point donné. La génération est ' +
      "asynchrone (peut prendre plusieurs dizaines de secondes) : dis simplement à l'utilisateur que " +
      "le plan est en cours de génération et qu'il apparaîtra dans le tiroir de tâches (icône cloche " +
      "en haut de l'écran) avec un lien de téléchargement dès qu'il sera prêt - ne mentionne jamais " +
      "d'identifiant technique dans ta réponse.",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        lon: { type: 'NUMBER' },
        lat: { type: 'NUMBER' },
        description: { type: 'STRING' },
        landmark: { type: 'STRING' },
      },
      required: ['title', 'lon', 'lat'],
    },
  },
  {
    name: 'activate_layer',
    description:
      "Active (affiche) une couche sur la carte pour l'utilisateur. Utilise l'identifiant obtenu via search_layers.",
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche à activer' },
        layerName: {
          type: 'STRING',
          description: 'Nom de la couche, pour référence dans la réponse',
        },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'deactivate_layer',
    description: 'Désactive (retire) une couche actuellement affichée sur la carte.',
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche à désactiver' },
        layerName: {
          type: 'STRING',
          description: 'Nom de la couche, pour référence dans la réponse',
        },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'zoom_to',
    description: 'Déplace et zoome la carte vers des coordonnées données.',
    parameters: {
      type: 'OBJECT',
      properties: {
        lon: { type: 'NUMBER' },
        lat: { type: 'NUMBER' },
        zoom: { type: 'NUMBER', description: 'Niveau de zoom (0-20), défaut 14' },
      },
      required: ['lon', 'lat'],
    },
  },
  {
    name: 'compute_geometry',
    description:
      "Calcule une géométrie (buffer/intersection/union/différence) et l'affiche sur la carte. " +
      'Pour buffer : geometryA = {type:"Point", coordinates:[lon,lat]}, distanceMeters requis. ' +
      'Pour intersection/union/difference : geometryA ET geometryB requis, chacun soit une ' +
      "géométrie GeoJSON directe, soit - pour réutiliser le résultat d'un compute_geometry " +
      'précédent dans CETTE conversation sans le recopier - geometryARef/geometryBRef avec le ' +
      '"label" retourné par cet appel précédent. Donne toujours un "label" court et mémorable ' +
      '(ex: "buffer_douala5") pour permettre de réutiliser ce résultat dans un appel suivant.',
    parameters: {
      type: 'OBJECT',
      properties: {
        operation: {
          type: 'STRING',
          description: "'buffer' | 'intersection' | 'union' | 'difference'",
        },
        label: { type: 'STRING', description: 'Nom court pour référencer ce résultat plus tard' },
        geometryA: { type: 'OBJECT', description: 'Géométrie GeoJSON directe (point/polygone...)' },
        geometryARef: {
          type: 'STRING',
          description: "Label d'un compute_geometry précédent à réutiliser",
        },
        geometryB: {
          type: 'OBJECT',
          description: 'Géométrie GeoJSON directe (intersection/union/difference)',
        },
        geometryBRef: {
          type: 'STRING',
          description: "Label d'un compute_geometry précédent à réutiliser",
        },
        distanceMeters: {
          type: 'NUMBER',
          description: 'Rayon en mètres (opération buffer uniquement)',
        },
      },
      required: ['operation', 'label'],
    },
  },
  {
    name: 'count_features_in_geometry',
    description:
      "Compte les entités d'une couche VECTORIELLE (obtenue via search_layers) qui se trouvent " +
      "dans une géométrie - typiquement le résultat d'un compute_geometry précédent (via " +
      'geometryRef). Pour des questions comme "combien d\'hôpitaux dans cette zone/intersection ?".',
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche vectorielle' },
        geometryRef: { type: 'STRING', description: "Label d'un compute_geometry précédent" },
        geometry: {
          type: 'OBJECT',
          description: 'Géométrie GeoJSON directe (si pas de geometryRef)',
        },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'get_raster_stats_in_geometry',
    description:
      "Statistiques (min/max/moyenne/somme) d'une couche RASTER (ex: population) sur une " +
      "géométrie - typiquement le résultat d'un compute_geometry précédent (via geometryRef). " +
      'Pour une couche de population, la "somme" est une estimation du nombre d\'habitants ' +
      'dans cette géométrie.',
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche raster' },
        geometryRef: { type: 'STRING', description: "Label d'un compute_geometry précédent" },
        geometry: {
          type: 'OBJECT',
          description: 'Géométrie GeoJSON directe (si pas de geometryRef)',
        },
      },
      required: ['layerId'],
    },
  },
  {
    name: 'analyze_map_context',
    description:
      'Analyse CROISÉE de toutes les couches actuellement actives sur la carte, restreinte à la ' +
      "zone actuellement affichée à l'écran (extent) - pas besoin de préciser quelles couches ni " +
      "quelle zone, c'est déjà connu du contexte de la conversation. Utilise cet outil pour des " +
      'demandes du type "analyse cette zone", "que peux-tu me dire sur ce qui est affiché ?", ou ' +
      'pour croiser plusieurs couches actives entre elles (ex: densité de population et nombre ' +
      "d'écoles). Ne fonctionne que si l'utilisateur a des couches actives - sinon demande-lui " +
      "d'en activer via activate_layer/search_layers d'abord.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'generate_analysis_report',
    description:
      "Génère un rapport d'analyse complet en PDF (asynchrone - prend environ une minute) à " +
      'partir des couches actuellement actives sur la carte (comme analyze_map_context, aucun ' +
      'layerId à fournir). Utilise cet outil pour des demandes explicites de document/rapport ' +
      '(ex: "fais-moi un rapport sur...", "génère une étude complète sur...", "j\'ai besoin d\'un ' +
      'PDF sur..."), PAS pour une simple question ponctuelle (utilise alors analyze_map_context ou ' +
      'les outils de comptage). Le rapport apparaîtra dans le tiroir de tâches (icône cloche) avec ' +
      "un lien de téléchargement une fois prêt - dis-le simplement à l'utilisateur, sans mentionner " +
      "d'identifiant technique. Ne fonctionne que si des couches sont actives.",
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: {
          type: 'STRING',
          description:
            'Sujet/titre du rapport, formulé clairement, ex: "Densité de population et ' +
            'couverture scolaire à Douala 3"',
        },
      },
      required: ['topic'],
    },
  },
];

const CLIENT_ACTION_TOOLS = new Set(['activate_layer', 'deactivate_layer', 'zoom_to']);
// 5 -> 9 : les chaînes d'outils multi-couches (ex: dessiner une zone, compter des entités
// dedans, croiser avec un raster) peuvent légitimement enchaîner 4-6 appels avant de conclure -
// voir plan "refonte Statistiques" du 2026-08-05, section agent IA.
const MAX_ITERATIONS = 9;
const MAX_CACHED_GEOMETRIES = 20;

// Base de connaissances condensée du géoportail (menu Outils + panneaux principaux) pour que
// l'assistant puisse répondre à des questions du type "comment fait-on X ?" même quand X
// n'est pas piloté par un outil (function-calling) - voir docs/fonctionnalites-detaillees.md
// pour la documentation complète, ceci n'en est qu'un résumé pour guider l'utilisateur dans
// l'interface.
const GEOPORTAL_GUIDE = `
Connaissance de l'interface GeOsm (pour répondre aux questions "comment faire X ?") :
- Barre de recherche (haut de l'écran) : recherche d'adresses/lieux (géocodage) et de couches, avec historique des recherches récentes.
- Panneau de gauche "Couches" : onglet Catalogue (parcourir les couches par thématique/sous-thématique), onglet Couches actives (opacité, visibilité, glisser-déposer pour réordonner, resynchronisation des données pour les admins), onglet Fonds de carte.
- Icône ✨ (Assistant IA) : ce chat.
- Icône signet (Géosignets) : sauvegarder des positions favorites sur la carte.
- Icône grille (Mes cartes) : sauvegarder/recharger des compositions de couches complètes.
- Icône carte (Fonds de carte) : changer le fond (satellite, standard...).
- Icône clé à molette (menu Outils), qui ouvre un panneau avec ces outils :
  - Dessin : dessiner points/lignes/polygones sur la carte.
  - Mesure : mesurer une distance ou une surface.
  - Itinéraire : calculer un trajet entre deux points (OSRM).
  - Export : télécharger les données d'une couche (GeoJSON, Shapefile, GeoPackage, KML, CSV).
  - Impression : générer un export PDF de la vue actuelle.
  - Commentaire : poser des commentaires géolocalisés sur la carte, avec fils de discussion et statut résolu/non résolu.
  - Altimétrie : profil d'élévation le long d'une ligne tracée.
  - Mapillary : vues panoramiques street-level.
  - Comparer : comparaison de deux cartes côte à côte (mode swipe).
  - Statistiques : nombre d'entités et répartition par propriété d'une couche, avec synthèse IA.
  - Plan de localisation : génère un PDF professionnel (échelle, grille, légende, flèche du nord personnalisables) pour un point choisi, avec rédaction IA optionnelle.
  - Analyse spatiale : buffer/intersection/union/différence entre géométries.
  - Recherche du plus proche : trouve l'entité d'une couche la plus proche par distance routière réelle.
- Clic droit sur la carte : menu contextuel (définir comme point de départ/arrivée d'itinéraire, voir les infos du lieu...).
- Bouton de partage : génère un lien court reproduisant l'état actuel de la carte.
`;

// Repères chiffrés APPROXIMATIFS (ordres de grandeur généraux, pas des statistiques officielles
// vérifiées pour un pays précis) pour ancrer les réponses de type "est-ce qu'il y a assez de
// X ?" sur une référence plutôt que sur une impression du modèle - voir plan "refonte
// Statistiques" du 2026-08-05. Toujours présentés comme indicatifs dans la consigne ci-dessous.
const BENCHMARK_REFERENCES =
  `
Repères indicatifs (ordres de grandeur généraux, PAS des statistiques officielles vérifiées - à ` +
  `présenter explicitement comme approximatifs si tu les utilises, jamais comme une vérité chiffrée) :
- Lits d'hôpital : un repère souvent cité (OMS/Banque mondiale, moyenne mondiale) est de l'ordre de 1 lit pour 1000 habitants ; très variable selon les pays et contextes.
- Écoles primaires : pas de ratio universel fiable - juge plutôt par comparaison relative entre zones de la même carte (densité de population similaire, nombre d'écoles très différent = signal pertinent) que par un chiffre absolu.
- Centres de santé de proximité : un repère parfois utilisé est un centre pour environ 10 000 habitants en zone urbaine dense, mais varie énormément.
`;

// Langue de réponse paramétrable (voir assistant.routes.ts, lu depuis Accept-Language) - avant
// ce changement, l'assistant répondait toujours en français quelle que soit la langue de
// l'interface, y compris pour un utilisateur ayant choisi l'anglais.
const RESPONSE_LANGUAGE_INSTRUCTION: Record<string, string> = {
  fr: 'Réponds toujours en français, de façon concise.',
  en: 'Always answer in English, concisely.',
  es: 'Responde siempre en español, de forma concisa.',
};

function buildMapContextBlock(mapContext?: AssistantMapContext): string {
  if (!mapContext || (!mapContext.extent && !mapContext.activeLayers?.length)) return '';
  const layersLine = mapContext.activeLayers?.length
    ? mapContext.activeLayers.map((l) => `${l.name} (id: ${l.id})`).join(', ')
    : 'aucune';
  const extentLine = mapContext.extent
    ? `[${mapContext.extent.map((n) => n.toFixed(4)).join(', ')}] (minLon, minLat, maxLon, maxLat)`
    : 'inconnue';
  return (
    `\nContexte carte actuel (mis à jour à chaque message, ne le redemande jamais à l'utilisateur) :\n` +
    `- Couches actuellement actives sur la carte : ${layersLine} - utilise ces IDs directement (pas ` +
    `besoin de search_layers si la couche voulue y figure déjà).\n` +
    `- Emprise actuellement visible à l'écran : ${extentLine} - c'est la "zone actuelle" implicite ` +
    `pour analyze_map_context et pour toute question sans zone explicitement précisée.\n`
  );
}

function buildCachedGeometriesBlock(geometryCache: Map<string, CachedGeometry>): string {
  if (geometryCache.size === 0) return '';
  const lines = [...geometryCache.entries()]
    .map(([label, entry]) => `${label} (${entry.summary})`)
    .join(', ');
  return (
    `\nGéométries déjà calculées dans cette conversation (y compris lors de messages précédents), ` +
    `réutilisables via geometryARef/geometryBRef/geometryRef SANS refaire le calcul : ${lines}.\n`
  );
}

function buildSystemInstruction(
  lang: string,
  mapContext?: AssistantMapContext,
  geometryCache?: Map<string, CachedGeometry>,
): string {
  const languageInstruction =
    RESPONSE_LANGUAGE_INSTRUCTION[lang] ?? RESPONSE_LANGUAGE_INSTRUCTION['fr'];
  return (
    `Tu es l'assistant du géoportail GeOsm (plateforme cartographique open-source basée sur OpenStreetMap). ` +
    `Tu as trois rôles : (1) agir sur la carte pour l'utilisateur en pilotant les outils disponibles, ` +
    `(2) analyser les données géographiques disponibles (une ou plusieurs couches, éventuellement croisées) ` +
    `pour produire de vraies déductions plutôt que de simples lectures de base de données, et (3) servir de ` +
    `guide utilisateur quand on te demande comment faire quelque chose dans l'interface (utilise la ` +
    `connaissance ci-dessous, sans inventer de fonctionnalité qui n'y figure pas). ${languageInstruction} ` +
    `Pour une demande comme "montre-moi les hôpitaux à Douala", enchaîne : geocode("Douala") pour situer la ` +
    `ville, search_layers("hôpitaux") pour trouver la couche, puis activate_layer et zoom_to pour l'afficher. ` +
    `Pour une demande d'analyse composée (ex: "dessine un cercle autour de X et Y, active les hôpitaux et ` +
    `analyse l'intersection"), enchaîne les outils dans l'ordre logique (compute_geometry, activate_layer, ` +
    `count_features_in_geometry/get_raster_stats_in_geometry) sans redemander confirmation à chaque étape - ` +
    `tu as jusqu'à ${MAX_ITERATIONS} appels d'outils avant de devoir conclure. RÈGLE IMPORTANTE : quand une ` +
    `demande contient PLUSIEURS étapes dans une même phrase (ex: "dessine X puis calcule Y puis dis-moi Z"), ` +
    `ne réponds JAMAIS en texte après une seule étape intermédiaire (ex: juste après avoir dessiné une ` +
    `géométrie) - continue d'appeler les outils suivants jusqu'à avoir traité TOUTE la demande, et ne rédige ` +
    `ta réponse texte finale qu'une fois la dernière étape terminée (ou si un outil échoue et bloque la ` +
    `suite, auquel cas explique clairement ce qui a été fait et ce qui a échoué). N'invente jamais d'identifiant ` +
    `de couche : utilise toujours un layerId obtenu via search_layers ou déjà connu du contexte carte ` +
    `ci-dessous. Si un outil échoue ou ne trouve rien, explique-le clairement à l'utilisateur plutôt que ` +
    `d'inventer une réponse. TRAÇABILITÉ : quand ta réponse s'appuie sur des données réellement lues sur ` +
    `une ou plusieurs couches (statistiques, comptage, analyse croisée...), mentionne explicitement leur ` +
    `nom dans le texte (ex: "D'après la couche Hôpitaux...") plutôt qu'une affirmation sans source - cela ` +
    `permet à l'utilisateur de vérifier d'où viennent les chiffres.` +
    `\n${GEOPORTAL_GUIDE}${BENCHMARK_REFERENCES}${buildMapContextBlock(mapContext)}` +
    `${buildCachedGeometriesBlock(geometryCache ?? new Map())}`
  );
}

export class AssistantChatUseCase {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly conversationRepository: PrismaAssistantConversationRepository,
    private readonly searchGeocodingUseCase: SearchGeocodingUseCase,
    private readonly searchLayersUseCase: SearchLayersUseCase,
    private readonly getLayerStatsUseCase: GetLayerStatsUseCase,
    private readonly spatialAnalysisUseCase: SpatialAnalysisUseCase,
    private readonly findNearestFeatureUseCase: FindNearestFeatureUseCase,
    private readonly createLocationPlanUseCase: CreateLocationPlanUseCase,
    private readonly countFeaturesInGeometryUseCase: CountFeaturesInGeometryUseCase,
    private readonly getRasterStatsInGeometryUseCase: GetRasterStatsInGeometryUseCase,
    private readonly summarizeViewportUseCase: SummarizeViewportUseCase,
    private readonly generateAnalysisReportUseCase: GenerateAnalysisReportUseCase,
    private readonly trackEventUseCase: TrackEventUseCase,
    private readonly layerRepository: ILayerRepository,
    private readonly getLayerRecommendationsUseCase: GetLayerRecommendationsUseCase,
    private readonly getSearchSuggestionsUseCase: GetSearchSuggestionsUseCase,
  ) {}

  async execute(
    userId: string,
    instanceId: string,
    conversationId: string,
    message: string,
    lang = 'fr',
    mapContext?: AssistantMapContext,
  ): Promise<AssistantChatResult> {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('AssistantConversation', conversationId);
    if (conversation.userId !== userId)
      throw new ForbiddenError('Cette conversation appartient à un autre utilisateur.');

    const priorTurns = (conversation.messages as unknown as AssistantMessageRecord[] | null) ?? [];
    const messages: GeminiMessage[] = [
      ...priorTurns.map((h): GeminiMessage => ({ role: h.role, text: h.text })),
      { role: 'user', text: message },
    ];
    const clientActions: AssistantClientAction[] = [];
    const attachments: AssistantAttachment[] = [];
    const sourcesUsed: AssistantSourceRef[] = [];
    // Une seule suggestion proactive par tour, prise sur le PREMIER activate_layer du tour -
    // en enchaîner une par couche activée (ex: "active hôpitaux et écoles") noierait la
    // réponse plutôt que d'aider (voir demande du 2026-08-06 "suggestions proactives").
    let suggestionNote: string | null = null;
    // Chargé depuis la conversation (pas un champ de classe - AssistantChatUseCase est partagé
    // entre requêtes concurrentes) et repersisté à la fin - voir compute_geometry/geometryARef.
    // Sans ça, un "dessine un cercle" dans un message puis "analyse cette zone" dans le message
    // SUIVANT ne retrouvait pas le cercle (vécu en conditions réelles le 2026-08-06).
    const geometryCache = new Map<string, CachedGeometry>(
      Object.entries(
        (conversation.geometryCache as unknown as Record<string, CachedGeometry> | null) ?? {},
      ),
    );
    // Le modèle ne "sait" qu'un label existe que si on le lui dit explicitement : l'historique
    // texte persisté (priorTurns) ne contient pas les appels d'outils d'un tour précédent, donc
    // sans cette liste il recalculait une géométrie déjà connue au lieu de réutiliser son label
    // (résultat correct mais appel redondant - vécu en conditions réelles le 2026-08-06).
    const systemInstruction = buildSystemInstruction(lang, mapContext, geometryCache);
    let reply = '';

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const result = await this.geminiService.generateWithTools(messages, TOOLS, systemInstruction);

      if (result.functionCalls.length === 0) {
        reply = result.text ?? '';
        break;
      }

      for (const call of result.functionCalls) {
        messages.push({ role: 'model', functionCall: call });

        if (CLIENT_ACTION_TOOLS.has(call.name)) {
          clientActions.push({ action: this.toClientActionName(call.name), ...call.args });
          messages.push({
            role: 'user',
            functionResponse: { name: call.name, response: { success: true } },
          });
          if (call.name === 'activate_layer' && !suggestionNote && call.args.layerId) {
            suggestionNote = await this.buildProactiveSuggestion(
              String(call.args.layerId),
              instanceId,
              lang,
            );
          }
          continue;
        }

        try {
          const { data, clientAction, attachment, source } = await this.executeDataTool(
            call.name,
            call.args,
            userId,
            instanceId,
            lang,
            mapContext,
            geometryCache,
          );
          if (clientAction) clientActions.push(clientAction);
          if (attachment) attachments.push(attachment);
          if (source) {
            for (const s of source) {
              if (!sourcesUsed.some((existing) => existing.layerId === s.layerId)) {
                sourcesUsed.push(s);
              }
            }
          }
          messages.push({
            role: 'user',
            functionResponse: { name: call.name, response: { data } },
          });
          // Détail par outil pour le tableau de bord d'usage admin (voir plan "tableau de
          // bord analytique" du 2026-08-05) - fire-and-forget, ne doit jamais ralentir ou
          // faire échouer la boucle d'outils de l'agent.
          this.trackEventUseCase
            .execute(instanceId, {
              eventType: 'assistant_tool_used',
              userId,
              metadata: { tool: call.name },
            })
            .catch(() => undefined);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn("Échec d'un outil de l'assistant IA", {
            tool: call.name,
            error: errorMessage,
          });
          messages.push({
            role: 'user',
            functionResponse: { name: call.name, response: { error: errorMessage } },
          });
        }
      }

      if (iteration === MAX_ITERATIONS - 1) {
        reply = "Désolé, je n'ai pas réussi à terminer cette demande. Peux-tu la reformuler ?";
      }
    }

    // Ajoutée après coup au texte final plutôt qu'injectée dans le prompt : une suggestion
    // déterministe (calcul SQL, pas une invention du modèle) n'a pas besoin de repasser par
    // Gemini, et cela garantit qu'elle apparaît même si le modèle conclut en une seule
    // itération (cas le plus fréquent pour un simple activate_layer).
    if (suggestionNote && reply) {
      reply = `${reply}\n\n💡 ${suggestionNote}`;
    }

    const now = new Date().toISOString();
    const updatedTurns: AssistantMessageRecord[] = [
      ...priorTurns,
      { role: 'user', text: message, createdAt: now },
      { role: 'model', text: reply, createdAt: now, sources: sourcesUsed },
    ];
    // Garde les MAX_CACHED_GEOMETRIES plus récentes (Map préserve l'ordre d'insertion) - un
    // historique de géométries indéfiniment croissant sur une longue conversation n'a pas de
    // sens, seules les dernières sont plausiblement encore référencées par l'utilisateur.
    const cachedEntries = [...geometryCache.entries()].slice(-MAX_CACHED_GEOMETRIES);
    const isFirstUserMessage = priorTurns.length === 0;
    await this.conversationRepository.update(conversationId, {
      messages: updatedTurns as unknown as import('@prisma/client').Prisma.InputJsonValue,
      geometryCache: Object.fromEntries(
        cachedEntries,
      ) as unknown as import('@prisma/client').Prisma.InputJsonValue,
      ...(isFirstUserMessage ? { title: message.slice(0, 60) } : {}),
    });

    return { conversationId, reply, clientActions, attachments, sources: sourcesUsed };
  }

  /** "Les utilisateurs qui ont activé X ont aussi activé Y" formulé en langage naturel,
   * déclenché juste après un activate_layer (voir demande du 2026-08-06). Repli sur les
   * couches les plus activées de l'instance si aucune co-activation trouvée (démarrage à
   * froid, même logique que GetSearchSuggestionsUseCase). Ne doit jamais faire échouer la
   * conversation : une erreur ici est juste avalée, la suggestion est un bonus. */
  private async buildProactiveSuggestion(
    layerId: string,
    instanceId: string,
    lang: string,
  ): Promise<string | null> {
    try {
      let recs = await this.getLayerRecommendationsUseCase.execute(layerId, instanceId, 2, lang);
      if (recs.length === 0) {
        const trending = await this.getSearchSuggestionsUseCase.execute(
          undefined,
          instanceId,
          3,
          lang,
        );
        recs = trending
          .filter((t) => t.id !== layerId)
          .slice(0, 2)
          .map((t) => ({ ...t, coUserCount: 0 }));
      }
      if (recs.length === 0) return null;

      const joiners: Record<string, string> = { fr: ' et ', en: ' and ', es: ' y ' };
      const names = recs.map((r) => r.name).join(joiners[lang] ?? joiners['fr']);
      const templates: Record<string, string> = {
        fr: `D'autres utilisateurs qui consultent cette couche activent souvent aussi ${names}.`,
        en: `Other users looking at this layer often also activate ${names}.`,
        es: `Otros usuarios que consultan esta capa también suelen activar ${names}.`,
      };
      return templates[lang] ?? templates['fr'];
    } catch (error) {
      logger.warn('Suggestion proactive indisponible', {
        layerId,
        instanceId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  private toClientActionName(toolName: string): 'activateLayer' | 'deactivateLayer' | 'zoomTo' {
    if (toolName === 'activate_layer') return 'activateLayer';
    if (toolName === 'deactivate_layer') return 'deactivateLayer';
    return 'zoomTo';
  }

  private async executeDataTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    instanceId: string,
    lang: string,
    mapContext: AssistantMapContext | undefined,
    geometryCache: Map<string, CachedGeometry>,
  ): Promise<DataToolResult> {
    switch (name) {
      case 'geocode': {
        const results = await this.searchGeocodingUseCase.execute(String(args.query), { limit: 1 });
        if (results.length === 0) return { data: { found: false } };
        const r = results[0];
        return {
          data: {
            found: true,
            lon: Number(r.lon),
            lat: Number(r.lat),
            displayName: r.display_name,
          },
        };
      }
      case 'search_layers': {
        const result = await this.searchLayersUseCase.execute(String(args.query), {
          instanceId,
          limit: 5,
        });
        return {
          data: result.hits.map((h) => ({
            id: h.id as string,
            name: h.name as string,
            description: (h.description as string) ?? null,
          })),
        };
      }
      case 'get_layer_stats': {
        const layerId = String(args.layerId);
        const [data, source] = await Promise.all([
          this.getLayerStatsUseCase.execute(layerId),
          this.resolveSource(layerId, lang),
        ]);
        return { data, source };
      }
      case 'buffer_around_point': {
        const analysisResult = await this.spatialAnalysisUseCase.execute({
          operation: 'buffer',
          geometryA: { type: 'Point', coordinates: [Number(args.lon), Number(args.lat)] },
          distance: Number(args.distanceMeters),
        });
        return {
          data: analysisResult,
          clientAction: {
            action: 'displayGeometry',
            geometry: analysisResult.geometry,
            label: `Zone tampon (${Number(args.distanceMeters)} m)`,
          },
        };
      }
      case 'find_nearest_feature': {
        const layerId = String(args.layerId);
        const [data, source] = await Promise.all([
          this.findNearestFeatureUseCase.execute(
            layerId,
            Number(args.lon),
            Number(args.lat),
            args.limit ? Number(args.limit) : undefined,
          ),
          this.resolveSource(layerId, lang),
        ]);
        return { data, source };
      }
      case 'create_location_plan': {
        // Retourne immédiatement sans attendre la fin du rendu QGIS (peut prendre plusieurs
        // dizaines de secondes sur une zone dense) - le tiroir de tâches (JobsTrayService côté
        // frontend, alimenté par NotificationService.notifyUser dans location-plan.worker.ts)
        // prend le relais et affiche le lien de téléchargement dès que le job se termine, que
        // la conversation soit encore ouverte ou non. Remplace l'ancien polling borné à 27s
        // (pollLocationPlanCompletion) qui bloquait la réponse HTTP et pouvait quand même
        // couper une génération encore en cours sur les zones les plus denses.
        const plan = await this.createLocationPlanUseCase.execute(userId, {
          instanceId,
          title: String(args.title),
          lon: Number(args.lon),
          lat: Number(args.lat),
          description: args.description ? String(args.description) : undefined,
          landmark: args.landmark ? String(args.landmark) : undefined,
        });
        return {
          data: { id: plan.id, title: plan.title, status: plan.status },
          attachment: {
            type: 'location-plan',
            id: plan.id,
            title: plan.title,
            status: plan.status,
          },
        };
      }
      case 'compute_geometry': {
        const operation = String(args.operation) as
          | 'buffer'
          | 'intersection'
          | 'union'
          | 'difference';
        const label = String(args.label);
        const geometryA = this.resolveGeometry(args, 'geometryA', 'geometryARef', geometryCache);
        const geometryB = this.resolveGeometry(args, 'geometryB', 'geometryBRef', geometryCache);
        if (!geometryA) throw new Error('geometryA (ou geometryARef) est requis');

        const analysisResult = await this.spatialAnalysisUseCase.execute({
          operation,
          geometryA,
          geometryB: geometryB ?? undefined,
          distance: args.distanceMeters != null ? Number(args.distanceMeters) : undefined,
        });
        if (!analysisResult.geometry) {
          throw new Error('Aucun résultat (géométries disjointes ?)');
        }

        const geometry = analysisResult.geometry as Record<string, unknown>;
        const distanceNote = args.distanceMeters != null ? `, ${Number(args.distanceMeters)}m` : '';
        geometryCache.set(label, {
          geometry,
          summary: `${operation}${distanceNote} -> ${(geometry.type as string) ?? 'géométrie'}`,
        });
        return {
          data: { label, geometryType: geometry.type },
          clientAction: { action: 'displayGeometry', geometry, label },
        };
      }
      case 'count_features_in_geometry': {
        const geometry = this.resolveGeometry(args, 'geometry', 'geometryRef', geometryCache);
        if (!geometry) throw new Error('geometry (ou geometryRef) est requis');
        const layerId = String(args.layerId);
        const [data, source] = await Promise.all([
          this.countFeaturesInGeometryUseCase.execute(layerId, geometry),
          this.resolveSource(layerId, lang),
        ]);
        return { data, source };
      }
      case 'get_raster_stats_in_geometry': {
        const geometry = this.resolveGeometry(args, 'geometry', 'geometryRef', geometryCache);
        if (!geometry) throw new Error('geometry (ou geometryRef) est requis');
        const layerId = String(args.layerId);
        const [data, source] = await Promise.all([
          this.getRasterStatsInGeometryUseCase.execute(layerId, geometry),
          this.resolveSource(layerId, lang),
        ]);
        return { data, source };
      }
      case 'analyze_map_context': {
        const activeLayers = mapContext?.activeLayers ?? [];
        if (activeLayers.length === 0) {
          throw new Error('Aucune couche active sur la carte actuellement.');
        }
        const data = await this.summarizeViewportUseCase.execute(
          activeLayers.map((l) => l.id),
          lang,
          mapContext?.extent,
        );
        return {
          data,
          source: activeLayers.map((l) => ({ layerId: l.id, layerName: l.name })),
        };
      }
      case 'generate_analysis_report': {
        const activeLayers = mapContext?.activeLayers ?? [];
        if (activeLayers.length === 0) {
          throw new Error('Aucune couche active sur la carte actuellement.');
        }
        const topic = String(args.topic);
        const { reportId } = await this.generateAnalysisReportUseCase.execute(
          userId,
          instanceId,
          topic,
          activeLayers.map((l) => l.id),
          mapContext?.extent,
        );
        return {
          data: { reportId },
          attachment: { type: 'analysis-report', id: reportId, title: topic, status: 'PENDING' },
          source: activeLayers.map((l) => ({ layerId: l.id, layerName: l.name })),
        };
      }
      default:
        throw new Error(`Outil inconnu : ${name}`);
    }
  }

  /** Résout geometryA/geometryB soit depuis une géométrie GeoJSON directe, soit depuis le label
   * d'un compute_geometry précédent (geometryARef/geometryBRef) - voir CachedGeometry. */
  private resolveGeometry(
    args: Record<string, unknown>,
    directKey: string,
    refKey: string,
    geometryCache: Map<string, CachedGeometry>,
  ): Record<string, unknown> | null {
    const ref = args[refKey];
    if (typeof ref === 'string' && ref.length > 0) {
      const cached = geometryCache.get(ref);
      if (!cached) throw new Error(`Référence de géométrie inconnue : "${ref}"`);
      return cached.geometry;
    }
    const direct = args[directKey];
    if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
    return null;
  }

  /** Résout le nom localisé d'une couche pour la citer comme source d'une réponse (voir
   * AssistantSourceRef) - une recherche supplémentaire par id (indexée, coût négligeable)
   * plutôt que de faire remonter le nom depuis chaque use case de données, qui ne le
   * retournent pas aujourd'hui (ils ne consomment que layerId). Silencieux si la couche a
   * disparu entre-temps : une source manquante ne doit jamais faire échouer la réponse. */
  private async resolveSource(layerId: string, lang: string): Promise<AssistantSourceRef[]> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) return [];
    return [{ layerId, layerName: localize(layer.name, lang) }];
  }
}
