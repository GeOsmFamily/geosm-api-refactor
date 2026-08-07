import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import type {
  PrismaAssistantConversationRepository,
  AssistantMessageRecord,
} from '../../../infrastructure/database/repositories/prisma-assistant-conversation.repository.js';
import type { PrismaInstanceFaqRepository } from '../../../infrastructure/database/repositories/prisma-instance-faq.repository.js';
import { logger } from '../../../infrastructure/observability/logger.js';

const MAX_QUESTIONS_IN_PROMPT = 200;

interface ClusteredFaqEntry {
  question: string;
  answer: string;
  sourceCount: number;
}

const CLUSTERING_PROMPT =
  "Voici une liste de questions posées par des visiteurs d'un géoportail (une par ligne, " +
  'certaines quasi-identiques ou reformulées). Regroupe-les en une FAQ synthétique : identifie ' +
  'les questions RÉCURRENTES ou représentatives (ignore les questions trop spécifiques à un cas ' +
  "isolé, ex: une adresse précise), formule une question claire et générique pour chaque groupe, " +
  "et rédige une réponse courte et factuelle (2-3 phrases) basée sur ce qu'un géoportail de ce " +
  "type permet de faire (recherche de lieux, activation de couches thématiques, mesures, export, " +
  "plans de localisation...). N'invente aucune donnée chiffrée précise que tu ne peux pas déduire " +
  "du contexte. Réponds STRICTEMENT en JSON, un tableau d'objets " +
  '{"question": string, "answer": string, "sourceCount": number} (sourceCount = nombre de ' +
  'questions du groupe ayant produit cette entrée), sans aucun texte avant ou après le JSON, sans ' +
  'balises markdown. Limite-toi à 10 entrées maximum, les plus représentatives.\n\nQuestions :\n';

/** Extrait les tours utilisateur des conversations récentes d'une instance, tous visiteurs
 * confondus - c'est la matière première regroupée/synthétisée par Gemini en Q/R. */
function extractUserQuestions(messagesJson: unknown): string[] {
  const turns = (messagesJson as AssistantMessageRecord[] | null) ?? [];
  return turns
    .filter((t) => t.role === 'user' && t.text?.trim())
    .map((t) => t.text.trim());
}

/** Gemini répond parfois avec des balises ```json ... ``` malgré la consigne stricte - on les
 * retire avant JSON.parse plutôt que d'échouer sur un cas facilement récupérable. */
function parseClusteredFaq(raw: string): ClusteredFaqEntry[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Réponse Gemini non conforme : tableau attendu');
  return parsed
    .filter(
      (e): e is ClusteredFaqEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ClusteredFaqEntry).question === 'string' &&
        typeof (e as ClusteredFaqEntry).answer === 'string',
    )
    .map((e) => ({
      question: e.question,
      answer: e.answer,
      sourceCount: Number.isFinite(e.sourceCount) ? e.sourceCount : 1,
    }));
}

/**
 * Génère un lot de FAQ en statut DRAFT à partir des questions réelles posées à l'assistant IA
 * sur une instance (voir plan "FAQ dynamique par instance" du 2026-08-06). Ne publie jamais
 * automatiquement - une FAQ générée à partir de conversations peut refléter des questions
 * sensibles (adresses, noms) qu'un admin doit relire avant toute diffusion publique.
 * Appelée par le job répétable BullMQ `faq-generation`, une instance à la fois.
 */
export class GenerateInstanceFaqUseCase {
  constructor(
    private readonly conversationRepository: PrismaAssistantConversationRepository,
    private readonly instanceFaqRepository: PrismaInstanceFaqRepository,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(instanceId: string, since: Date): Promise<{ created: number }> {
    const conversations = await this.conversationRepository.findAllByInstance(instanceId, {
      since,
    });
    const questions = conversations
      .flatMap((c) => extractUserQuestions(c.messages))
      .slice(0, MAX_QUESTIONS_IN_PROMPT);

    if (questions.length === 0) {
      logger.debug('Aucune question récente pour la génération de FAQ', { instanceId });
      return { created: 0 };
    }

    let entries: ClusteredFaqEntry[];
    try {
      const raw = await this.geminiService.generateText(
        `${CLUSTERING_PROMPT}${questions.map((q) => `- ${q}`).join('\n')}`,
      );
      entries = parseClusteredFaq(raw);
    } catch (error) {
      // Une génération ratée ne doit jamais faire échouer le job récurrent pour les autres
      // instances - même posture de résilience que SummarizeViewportUseCase face à Gemini.
      logger.warn('Génération de FAQ indisponible (Gemini)', {
        instanceId,
        error: error instanceof Error ? error.message : error,
      });
      return { created: 0 };
    }

    if (entries.length === 0) return { created: 0 };

    const result = await this.instanceFaqRepository.createMany(
      entries.map((e) => ({
        instanceId,
        question: e.question,
        answer: e.answer,
        sourceCount: e.sourceCount,
      })),
    );
    logger.info('FAQ générée', { instanceId, created: result.count });
    return { created: result.count };
  }
}
