import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { AssistantChatUseCase } from '../../application/use-cases/assistant/assistant-chat.use-case.js';
import { ListAssistantConversationsUseCase } from '../../application/use-cases/assistant/list-assistant-conversations.use-case.js';
import { CreateAssistantConversationUseCase } from '../../application/use-cases/assistant/create-assistant-conversation.use-case.js';
import { GetAssistantConversationUseCase } from '../../application/use-cases/assistant/get-assistant-conversation.use-case.js';
import { DeleteAssistantConversationUseCase } from '../../application/use-cases/assistant/delete-assistant-conversation.use-case.js';
import { resolveLang } from '../utils/lang.util.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const chatBodySchema = z.object({
  instanceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

const listConversationsQuerySchema = z.object({ instanceId: z.string().uuid() });
const createConversationBodySchema = z.object({ instanceId: z.string().uuid() });
const conversationIdParamSchema = z.object({ id: z.string().uuid() });

export async function assistantRoutes(app: FastifyInstance): Promise<void> {
  const assistantChatUseCase = app.diContainer.resolve<AssistantChatUseCase>('assistantChatUseCase');
  const listAssistantConversationsUseCase = app.diContainer.resolve<ListAssistantConversationsUseCase>('listAssistantConversationsUseCase');
  const createAssistantConversationUseCase = app.diContainer.resolve<CreateAssistantConversationUseCase>('createAssistantConversationUseCase');
  const getAssistantConversationUseCase = app.diContainer.resolve<GetAssistantConversationUseCase>('getAssistantConversationUseCase');
  const deleteAssistantConversationUseCase = app.diContainer.resolve<DeleteAssistantConversationUseCase>('deleteAssistantConversationUseCase');

  // GET /api/v1/assistant/conversations?instanceId=...
  app.get('/conversations', {
    schema: { description: 'Lister les conversations de l\'assistant IA de l\'utilisateur', tags: ['Assistant IA'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listConversationsQuerySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(listConversationsQuerySchema, request.query);
    const userId = (request.user as { sub: string }).sub;
    const result = await listAssistantConversationsUseCase.execute(userId, instanceId);
    return reply.send(successResponse(result));
  });

  // POST /api/v1/assistant/conversations
  app.post('/conversations', {
    schema: { description: 'Créer une nouvelle conversation avec l\'assistant IA', tags: ['Assistant IA'], security: [{ bearerAuth: [] }], body: zodToSwagger(createConversationBodySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(createConversationBodySchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const result = await createAssistantConversationUseCase.execute(userId, instanceId);
    return reply.status(201).send(successResponse(result));
  });

  // GET /api/v1/assistant/conversations/:id
  app.get('/conversations/:id', {
    schema: { description: 'Détail d\'une conversation (avec historique complet)', tags: ['Assistant IA'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(conversationIdParamSchema, request.params);
    const userId = (request.user as { sub: string }).sub;
    const result = await getAssistantConversationUseCase.execute(userId, id);
    return reply.send(successResponse(result));
  });

  // DELETE /api/v1/assistant/conversations/:id
  app.delete('/conversations/:id', {
    schema: { description: 'Supprimer une conversation', tags: ['Assistant IA'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(conversationIdParamSchema, request.params);
    const userId = (request.user as { sub: string }).sub;
    await deleteAssistantConversationUseCase.execute(userId, id);
    return reply.status(204).send();
  });

  // POST /api/v1/assistant/chat
  // Assistant IA agentique (Gemini function-calling) : pilote les endpoints existants
  // (analyse spatiale, recherche, plan de localisation...) comme des "outils". Les actions
  // qui ne peuvent exister que côté client (activer/désactiver une couche, zoomer, afficher
  // une géométrie - voir MapLayerService/MapService dans le frontend) sont renvoyées dans
  // `clientActions` pour que le frontend les exécute lui-même, jamais exécutées par le
  // backend. L'historique est persisté côté serveur par conversation (voir
  // AssistantConversation) - le client n'a besoin de renvoyer que le nouveau message.
  app.post('/chat', {
    schema: {
      description: 'Discuter avec l\'assistant IA du géoportail (function-calling Gemini)',
      tags: ['Assistant IA'],
      security: [{ bearerAuth: [] }],
      body: zodToSwagger(chatBodySchema),
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, conversationId, message } = parseBody(chatBodySchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const result = await assistantChatUseCase.execute(userId, instanceId, conversationId, message, resolveLang(request));
    return reply.send(successResponse(result));
  });
}
