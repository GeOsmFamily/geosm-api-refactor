import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../schemas/auth.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { RegisterUseCase } from '../../application/use-cases/auth/register.use-case.js';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh-token.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case.js';
import { VerifyEmailUseCase } from '../../application/use-cases/auth/verify-email.use-case.js';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case.js';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case.js';
import { GetProfileUseCase } from '../../application/use-cases/auth/get-profile.use-case.js';
import { UpdateProfileUseCase } from '../../application/use-cases/auth/update-profile.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/auth/change-password.use-case.js';
import { OsmLoginUseCase } from '../../application/use-cases/auth/osm-login.use-case.js';
import { LinkOsmAccountUseCase } from '../../application/use-cases/auth/link-osm-account.use-case.js';
import { UnlinkOsmAccountUseCase } from '../../application/use-cases/auth/unlink-osm-account.use-case.js';
import { GetOsmProfileUseCase } from '../../application/use-cases/auth/get-osm-profile.use-case.js';
import { OsmOAuthService } from '../../infrastructure/external-apis/osm-oauth.service.js';
import { signOAuthState, verifyOAuthState } from '../../infrastructure/utils/oauth-state.util.js';
import { config } from '../../config/env.config.js';
import { logger } from '../../infrastructure/observability/logger.js';

function parseBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error?.format() as Record<string, unknown>,
    );
  }
  return result.data as T;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const registerUseCase = app.diContainer.resolve<RegisterUseCase>('registerUseCase');
  const loginUseCase = app.diContainer.resolve<LoginUseCase>('loginUseCase');
  const refreshTokenUseCase = app.diContainer.resolve<RefreshTokenUseCase>('refreshTokenUseCase');
  const logoutUseCase = app.diContainer.resolve<LogoutUseCase>('logoutUseCase');
  const verifyEmailUseCase = app.diContainer.resolve<VerifyEmailUseCase>('verifyEmailUseCase');
  const forgotPasswordUseCase =
    app.diContainer.resolve<ForgotPasswordUseCase>('forgotPasswordUseCase');
  const resetPasswordUseCase =
    app.diContainer.resolve<ResetPasswordUseCase>('resetPasswordUseCase');
  const getProfileUseCase = app.diContainer.resolve<GetProfileUseCase>('getProfileUseCase');
  const updateProfileUseCase =
    app.diContainer.resolve<UpdateProfileUseCase>('updateProfileUseCase');
  const changePasswordUseCase =
    app.diContainer.resolve<ChangePasswordUseCase>('changePasswordUseCase');
  const osmLoginUseCase = app.diContainer.resolve<OsmLoginUseCase>('osmLoginUseCase');
  const linkOsmAccountUseCase =
    app.diContainer.resolve<LinkOsmAccountUseCase>('linkOsmAccountUseCase');
  const unlinkOsmAccountUseCase =
    app.diContainer.resolve<UnlinkOsmAccountUseCase>('unlinkOsmAccountUseCase');
  const getOsmProfileUseCase =
    app.diContainer.resolve<GetOsmProfileUseCase>('getOsmProfileUseCase');
  const osmOAuthService = app.diContainer.resolve<OsmOAuthService>('osmOAuthService');

  app.post(
    '/register',
    {
      schema: {
        description: "Inscription d'un nouvel utilisateur",
        tags: ['Authentification'],
        body: zodToSwagger(registerSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(registerSchema, request.body);
      const result = await registerUseCase.execute(dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.post(
    '/login',
    {
      schema: {
        description: 'Connexion utilisateur',
        tags: ['Authentification'],
        body: zodToSwagger(loginSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(loginSchema, request.body);
      const result = await loginUseCase.execute(dto);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        description: "Rafraichissement du token d'acces",
        tags: ['Authentification'],
        body: zodToSwagger(refreshTokenSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(refreshTokenSchema, request.body);
      const result = await refreshTokenUseCase.execute(dto);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        description: 'Deconnexion utilisateur',
        tags: ['Authentification'],
        body: zodToSwagger(logoutSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(logoutSchema, request.body);
      await logoutUseCase.execute(dto);
      return reply.send(successResponse(null));
    },
  );

  app.post(
    '/verify-email',
    {
      schema: {
        description: "Verification de l'adresse email",
        tags: ['Authentification'],
        body: zodToSwagger(verifyEmailSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(verifyEmailSchema, request.body);
      await verifyEmailUseCase.execute(dto);
      return reply.send(successResponse(null));
    },
  );

  app.post(
    '/forgot-password',
    {
      schema: {
        description: 'Demande de reinitialisation du mot de passe',
        tags: ['Authentification'],
        body: zodToSwagger(forgotPasswordSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(forgotPasswordSchema, request.body);
      await forgotPasswordUseCase.execute(dto);
      return reply.send(successResponse(null));
    },
  );

  app.post(
    '/reset-password',
    {
      schema: {
        description: 'Reinitialisation du mot de passe',
        tags: ['Authentification'],
        body: zodToSwagger(resetPasswordSchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(resetPasswordSchema, request.body);
      await resetPasswordUseCase.execute(dto);
      return reply.send(successResponse(null));
    },
  );

  app.get(
    '/me',
    {
      schema: {
        description: "Consulter le profil de l'utilisateur connecte",
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getProfileUseCase.execute(request.user.sub);
      return reply.send(successResponse(result));
    },
  );

  app.patch(
    '/me',
    {
      schema: {
        description: 'Mettre a jour le profil',
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateProfileSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(updateProfileSchema, request.body);
      const result = await updateProfileUseCase.execute(request.user.sub, dto);
      return reply.send(successResponse(result));
    },
  );

  app.put(
    '/me/password',
    {
      schema: {
        description: 'Changer le mot de passe',
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(changePasswordSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(changePasswordSchema, request.body);
      await changePasswordUseCase.execute(request.user.sub, dto);
      return reply.send(successResponse(null));
    },
  );

  // --- Auth OpenStreetMap (OAuth 2.0) ---

  // GET /auth/osm/status - le frontend masque le bouton "Se connecter avec OpenStreetMap"
  // si OSM_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI ne sont pas configurés (voir env.config.ts).
  app.get(
    '/osm/status',
    {
      schema: {
        description: 'Vérifie si la connexion OpenStreetMap est configurée',
        tags: ['Authentification'],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(successResponse({ configured: osmOAuthService.isConfigured() }));
    },
  );

  // GET /auth/osm/login-url - retourne l'URL d'autorisation OSM plutôt que de rediriger
  // directement, pour que le frontend contrôle la navigation (window.location.href = url).
  app.get(
    '/osm/login-url',
    {
      schema: {
        description: "Obtenir l'URL de connexion OpenStreetMap",
        tags: ['Authentification'],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const state = signOAuthState({ purpose: 'login' });
      return reply.send(successResponse({ url: osmOAuthService.getAuthorizationUrl(state) }));
    },
  );

  // GET /auth/osm/link-url - même principe pour lier un compte OSM à un compte GeOSM déjà
  // connecté. Le userId est embarqué dans le state signé (et non lu depuis le header
  // Authorization) car une redirection plein-écran du navigateur ne transporte pas ce header -
  // seul cet appel initial (un fetch, pas une navigation) peut s'authentifier normalement.
  app.get(
    '/osm/link-url',
    {
      schema: {
        description: "Obtenir l'URL pour lier un compte OpenStreetMap",
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const state = signOAuthState({ purpose: 'link', userId: request.user.sub });
      return reply.send(successResponse({ url: osmOAuthService.getAuthorizationUrl(state) }));
    },
  );

  const osmCallbackQuerySchema = z.object({ code: z.string(), state: z.string() });

  // GET /auth/osm/callback - point de retour unique pour les deux flux (login et link),
  // différenciés par `purpose` dans le state signé. Redirige vers le frontend en fin de
  // parcours plutôt que de renvoyer du JSON (c'est une navigation plein-écran initiée par OSM).
  app.get(
    '/osm/callback',
    {
      schema: { description: 'Callback OAuth OpenStreetMap', tags: ['Authentification'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = parseBody(osmCallbackQuerySchema, request.query);
      const statePayload = verifyOAuthState(query.state);
      if (!statePayload) {
        return reply.redirect(`${config.CORS_ORIGIN}/login?osmError=invalid_state`);
      }

      try {
        if (statePayload.purpose === 'link') {
          await linkOsmAccountUseCase.execute(statePayload.userId, query.code);
          // Le panneau "Profil" côté frontend est le panneau Paramètres existant (voir
          // MapLayoutComponent.navigateToProfile() -> toggleSettings()), pas une route dédiée.
          return reply.redirect(`${config.CORS_ORIGIN}/map?openSettings=1&osmLinked=1`);
        }
        const tokens = await osmLoginUseCase.execute(query.code);
        return reply.redirect(
          `${config.CORS_ORIGIN}/auth/callback?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`,
        );
      } catch (err) {
        logger.error('OSM OAuth callback failed', {
          error: (err as Error).message,
          purpose: statePayload.purpose,
        });
        const errorTarget =
          statePayload.purpose === 'link' ? '/map?openSettings=1&osmError=1' : '/login?osmError=1';
        return reply.redirect(`${config.CORS_ORIGIN}${errorTarget}`);
      }
    },
  );

  app.get(
    '/osm/profile',
    {
      schema: {
        description: 'Consulter le profil OpenStreetMap lié',
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getOsmProfileUseCase.execute(request.user.sub);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/osm/link',
    {
      schema: {
        description: 'Délier le compte OpenStreetMap',
        tags: ['Authentification'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await unlinkOsmAccountUseCase.execute(request.user.sub);
      return reply.send(successResponse(null));
    },
  );
}
