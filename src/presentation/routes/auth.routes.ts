import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  }
  return result.data as T;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const registerUseCase = app.diContainer.resolve<RegisterUseCase>('registerUseCase');
  const loginUseCase = app.diContainer.resolve<LoginUseCase>('loginUseCase');
  const refreshTokenUseCase = app.diContainer.resolve<RefreshTokenUseCase>('refreshTokenUseCase');
  const logoutUseCase = app.diContainer.resolve<LogoutUseCase>('logoutUseCase');
  const verifyEmailUseCase = app.diContainer.resolve<VerifyEmailUseCase>('verifyEmailUseCase');
  const forgotPasswordUseCase = app.diContainer.resolve<ForgotPasswordUseCase>('forgotPasswordUseCase');
  const resetPasswordUseCase = app.diContainer.resolve<ResetPasswordUseCase>('resetPasswordUseCase');
  const getProfileUseCase = app.diContainer.resolve<GetProfileUseCase>('getProfileUseCase');
  const updateProfileUseCase = app.diContainer.resolve<UpdateProfileUseCase>('updateProfileUseCase');
  const changePasswordUseCase = app.diContainer.resolve<ChangePasswordUseCase>('changePasswordUseCase');

  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(registerSchema, request.body);
    const result = await registerUseCase.execute(dto);
    return reply.status(201).send(successResponse(result));
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(loginSchema, request.body);
    const result = await loginUseCase.execute(dto);
    return reply.send(successResponse(result));
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(refreshTokenSchema, request.body);
    const result = await refreshTokenUseCase.execute(dto);
    return reply.send(successResponse(result));
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(logoutSchema, request.body);
    await logoutUseCase.execute(dto);
    return reply.send(successResponse(null));
  });

  app.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(verifyEmailSchema, request.body);
    await verifyEmailUseCase.execute(dto);
    return reply.send(successResponse(null));
  });

  app.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(forgotPasswordSchema, request.body);
    await forgotPasswordUseCase.execute(dto);
    return reply.send(successResponse(null));
  });

  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(resetPasswordSchema, request.body);
    await resetPasswordUseCase.execute(dto);
    return reply.send(successResponse(null));
  });

  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getProfileUseCase.execute(request.user.sub);
      return reply.send(successResponse(result));
    },
  );

  app.patch(
    '/me',
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(updateProfileSchema, request.body);
      const result = await updateProfileUseCase.execute(request.user.sub, dto);
      return reply.send(successResponse(result));
    },
  );

  app.put(
    '/me/password',
    { preHandler: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(changePasswordSchema, request.body);
      await changePasswordUseCase.execute(request.user.sub, dto);
      return reply.send(successResponse(null));
    },
  );
}
