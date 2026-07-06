import type { GeminiService, GeminiFunctionDeclaration, GeminiMessage } from '../../../infrastructure/external-apis/gemini.service.js';
import type { SearchGeocodingUseCase } from '../geocoding/search-geocoding.use-case.js';
import type { SearchLayersUseCase } from '../search/search-layers.use-case.js';
import type { GetLayerStatsUseCase } from '../layers/get-layer-stats.use-case.js';
import type { SpatialAnalysisUseCase } from '../analysis/spatial-analysis.use-case.js';
import type { FindNearestFeatureUseCase } from '../routing/find-nearest-feature.use-case.js';
import type { CreateLocationPlanUseCase } from '../location-plans/create-location-plan.use-case.js';
import type { GetLocationPlanUseCase } from '../location-plans/get-location-plan.use-case.js';
import type { PrismaAssistantConversationRepository, AssistantMessageRecord } from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface AssistantClientAction {
  action: 'activateLayer' | 'deactivateLayer' | 'zoomTo' | 'displayGeometry';
  [key: string]: unknown;
}

export interface AssistantAttachment {
  type: 'location-plan';
  id: string;
  title: string;
  status: string;
  downloadUrl?: string;
}

export interface AssistantChatResult {
  conversationId: string;
  reply: string;
  clientActions: AssistantClientAction[];
  attachments: AssistantAttachment[];
}

interface DataToolResult {
  data: unknown;
  clientAction?: AssistantClientAction;
  attachment?: AssistantAttachment;
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
    description: 'Trouve les coordonnées géographiques (latitude/longitude) d\'un lieu nommé (ville, quartier, adresse...).',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Le nom du lieu à rechercher, ex: "Douala"' } },
      required: ['query'],
    },
  },
  {
    name: 'search_layers',
    description: 'Recherche des couches cartographiques disponibles sur le géoportail par mot-clé (ex: "hôpitaux", "écoles").',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Le terme de recherche' } },
      required: ['query'],
    },
  },
  {
    name: 'get_layer_stats',
    description: 'Obtient les statistiques (nombre d\'entités, superficie, longueur) d\'une couche à partir de son identifiant.',
    parameters: {
      type: 'OBJECT',
      properties: { layerId: { type: 'STRING', description: 'Identifiant UUID de la couche' } },
      required: ['layerId'],
    },
  },
  {
    name: 'buffer_around_point',
    description: 'Calcule une zone tampon (cercle) autour d\'un point et l\'affiche sur la carte, pour des requêtes comme "à moins de 5km de X".',
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
    description: 'Trouve les entités d\'une couche les plus proches d\'un point, classées par distance routière réelle.',
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
    description: 'Génère un plan de localisation professionnel en PDF pour un point donné. Un bouton de téléchargement apparaît '
      + 'automatiquement dans l\'interface une fois prêt - ne mentionne jamais d\'identifiant technique dans ta réponse, dis '
      + 'simplement que le plan est prêt et peut être téléchargé ci-dessous (ou qu\'il est encore en cours si le statut n\'est pas COMPLETED).',
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
    description: 'Active (affiche) une couche sur la carte pour l\'utilisateur. Utilise l\'identifiant obtenu via search_layers.',
    parameters: {
      type: 'OBJECT',
      properties: {
        layerId: { type: 'STRING', description: 'Identifiant UUID de la couche à activer' },
        layerName: { type: 'STRING', description: 'Nom de la couche, pour référence dans la réponse' },
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
        layerName: { type: 'STRING', description: 'Nom de la couche, pour référence dans la réponse' },
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
];

const CLIENT_ACTION_TOOLS = new Set(['activate_layer', 'deactivate_layer', 'zoom_to']);
const MAX_ITERATIONS = 5;
const LOCATION_PLAN_POLL_INTERVAL_MS = 1500;
// 18 x 1.5s = 27s - mesuré en pratique : le rendu QGIS d'une zone dense (ex. Douala) peut
// dépasser 20s, une fenêtre plus courte laissait parfois le plan encore "PROCESSING" au
// moment de répondre alors qu'il se terminait quelques secondes plus tard.
const LOCATION_PLAN_POLL_MAX_TRIES = 18;

// Base de connaissances condensée du géoportail (menu Outils + panneaux principaux) pour que
// l'assistant puisse répondre à des questions du type "comment fait-on X ?" même quand X
// n'est pas piloté par un outil (function-calling) - voir docs/fonctionnalites-detaillees.md
// pour la documentation complète, ceci n'en est qu'un résumé pour guider l'utilisateur dans
// l'interface.
const GEOPORTAL_GUIDE = `
Connaissance de l'interface GeOSM (pour répondre aux questions "comment faire X ?") :
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

// Langue de réponse paramétrable (voir assistant.routes.ts, lu depuis Accept-Language) - avant
// ce changement, l'assistant répondait toujours en français quelle que soit la langue de
// l'interface, y compris pour un utilisateur ayant choisi l'anglais.
const RESPONSE_LANGUAGE_INSTRUCTION: Record<string, string> = {
  fr: 'Réponds toujours en français, de façon concise.',
  en: 'Always answer in English, concisely.',
  es: 'Responde siempre en español, de forma concisa.',
};

function buildSystemInstruction(lang: string): string {
  const languageInstruction = RESPONSE_LANGUAGE_INSTRUCTION[lang] ?? RESPONSE_LANGUAGE_INSTRUCTION['fr'];
  return `Tu es l'assistant du géoportail GeOSM (plateforme cartographique open-source basée sur OpenStreetMap). `
    + `Tu as deux rôles : (1) agir sur la carte pour l'utilisateur en pilotant les outils disponibles, et (2) servir de guide `
    + `utilisateur quand on te demande comment faire quelque chose dans l'interface (utilise la connaissance ci-dessous, sans `
    + `inventer de fonctionnalité qui n'y figure pas). ${languageInstruction} Pour une demande comme `
    + `"montre-moi les hôpitaux à Douala", enchaîne : geocode("Douala") pour situer la ville, search_layers("hôpitaux") pour `
    + `trouver la couche, puis activate_layer et zoom_to pour l'afficher. N'invente jamais d'identifiant de couche : utilise `
    + `toujours un layerId obtenu via search_layers. Si un outil échoue ou ne trouve rien, explique-le clairement à l'utilisateur `
    + `plutôt que d'inventer une réponse.\n${GEOPORTAL_GUIDE}`;
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
    private readonly getLocationPlanUseCase: GetLocationPlanUseCase,
  ) {}

  async execute(userId: string, instanceId: string, conversationId: string, message: string, lang = 'fr'): Promise<AssistantChatResult> {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('AssistantConversation', conversationId);
    if (conversation.userId !== userId) throw new ForbiddenError('Cette conversation appartient à un autre utilisateur.');

    const priorTurns = (conversation.messages as unknown as AssistantMessageRecord[] | null) ?? [];
    const messages: GeminiMessage[] = [
      ...priorTurns.map((h): GeminiMessage => ({ role: h.role, text: h.text })),
      { role: 'user', text: message },
    ];
    const clientActions: AssistantClientAction[] = [];
    const attachments: AssistantAttachment[] = [];
    const systemInstruction = buildSystemInstruction(lang);
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
          messages.push({ role: 'user', functionResponse: { name: call.name, response: { success: true } } });
          continue;
        }

        try {
          const { data, clientAction, attachment } = await this.executeDataTool(call.name, call.args, userId, instanceId);
          if (clientAction) clientActions.push(clientAction);
          if (attachment) attachments.push(attachment);
          messages.push({ role: 'user', functionResponse: { name: call.name, response: { data } } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn('Échec d\'un outil de l\'assistant IA', { tool: call.name, error: errorMessage });
          messages.push({ role: 'user', functionResponse: { name: call.name, response: { error: errorMessage } } });
        }
      }

      if (iteration === MAX_ITERATIONS - 1) {
        reply = 'Désolé, je n\'ai pas réussi à terminer cette demande. Peux-tu la reformuler ?';
      }
    }

    const now = new Date().toISOString();
    const updatedTurns: AssistantMessageRecord[] = [
      ...priorTurns,
      { role: 'user', text: message, createdAt: now },
      { role: 'model', text: reply, createdAt: now },
    ];
    const isFirstUserMessage = priorTurns.length === 0;
    await this.conversationRepository.update(conversationId, {
      messages: updatedTurns as unknown as import('@prisma/client').Prisma.InputJsonValue,
      ...(isFirstUserMessage ? { title: message.slice(0, 60) } : {}),
    });

    return { conversationId, reply, clientActions, attachments };
  }

  private toClientActionName(toolName: string): 'activateLayer' | 'deactivateLayer' | 'zoomTo' {
    if (toolName === 'activate_layer') return 'activateLayer';
    if (toolName === 'deactivate_layer') return 'deactivateLayer';
    return 'zoomTo';
  }

  private async executeDataTool(name: string, args: Record<string, unknown>, userId: string, instanceId: string): Promise<DataToolResult> {
    switch (name) {
      case 'geocode': {
        const results = await this.searchGeocodingUseCase.execute(String(args.query), { limit: 1 });
        if (results.length === 0) return { data: { found: false } };
        const r = results[0];
        return { data: { found: true, lon: Number(r.lon), lat: Number(r.lat), displayName: r.display_name } };
      }
      case 'search_layers': {
        const result = await this.searchLayersUseCase.execute(String(args.query), { instanceId, limit: 5 });
        return { data: result.hits.map((h) => ({ id: h.id as string, name: h.name as string, description: (h.description as string) ?? null })) };
      }
      case 'get_layer_stats':
        return { data: await this.getLayerStatsUseCase.execute(String(args.layerId)) };
      case 'buffer_around_point': {
        const analysisResult = await this.spatialAnalysisUseCase.execute({
          operation: 'buffer',
          geometryA: { type: 'Point', coordinates: [Number(args.lon), Number(args.lat)] },
          distance: Number(args.distanceMeters),
        });
        return {
          data: analysisResult,
          clientAction: { action: 'displayGeometry', geometry: analysisResult.geometry, label: `Zone tampon (${Number(args.distanceMeters)} m)` },
        };
      }
      case 'find_nearest_feature':
        return {
          data: await this.findNearestFeatureUseCase.execute(
            String(args.layerId), Number(args.lon), Number(args.lat), args.limit ? Number(args.limit) : undefined,
          ),
        };
      case 'create_location_plan': {
        const plan = await this.createLocationPlanUseCase.execute(userId, {
          instanceId,
          title: String(args.title),
          lon: Number(args.lon),
          lat: Number(args.lat),
          description: args.description ? String(args.description) : undefined,
          landmark: args.landmark ? String(args.landmark) : undefined,
        });
        const finalPlan = await this.pollLocationPlanCompletion(plan.id);
        return {
          data: { id: finalPlan.id, title: finalPlan.title, status: finalPlan.status },
          attachment: {
            type: 'location-plan',
            id: finalPlan.id,
            title: finalPlan.title,
            status: finalPlan.status,
            downloadUrl: finalPlan.status === 'COMPLETED' ? `/api/v1/location-plans/${finalPlan.id}/download` : undefined,
          },
        };
      }
      default:
        throw new Error(`Outil inconnu : ${name}`);
    }
  }

  // Le PDF est généré de façon asynchrone (BullMQ, voir CreateLocationPlanUseCase) - on
  // patiente ici un temps borné pour pouvoir proposer le téléchargement direct dans la même
  // réponse de chat plutôt que de laisser l'utilisateur aller le chercher dans l'outil dédié.
  private async pollLocationPlanCompletion(id: string) {
    let plan = await this.getLocationPlanUseCase.execute(id);
    let tries = 0;
    while (plan.status !== 'COMPLETED' && plan.status !== 'FAILED' && tries < LOCATION_PLAN_POLL_MAX_TRIES) {
      await new Promise((resolve) => setTimeout(resolve, LOCATION_PLAN_POLL_INTERVAL_MS));
      plan = await this.getLocationPlanUseCase.execute(id);
      tries++;
    }
    return plan;
  }
}
