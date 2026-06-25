import { PrismaClient } from '@prisma/client';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, asValue, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';

import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/repositories/prisma-refresh-token.repository.js';
import { Argon2PasswordService } from './infrastructure/auth/argon2-password.service.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token.service.js';
import { RedisService } from './infrastructure/cache/redis.service.js';

import { RegisterUseCase } from './application/use-cases/auth/register.use-case.js';
import { LoginUseCase } from './application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/refresh-token.use-case.js';
import { LogoutUseCase } from './application/use-cases/auth/logout.use-case.js';
import { VerifyEmailUseCase } from './application/use-cases/auth/verify-email.use-case.js';
import { ForgotPasswordUseCase } from './application/use-cases/auth/forgot-password.use-case.js';
import { ResetPasswordUseCase } from './application/use-cases/auth/reset-password.use-case.js';
import { GetProfileUseCase } from './application/use-cases/auth/get-profile.use-case.js';
import { UpdateProfileUseCase } from './application/use-cases/auth/update-profile.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/auth/change-password.use-case.js';

import type { IEmailService } from './application/services/email.service.js';
import { logger } from './infrastructure/observability/logger.js';

class NoopEmailService implements IEmailService {
  async sendVerificationEmail(email: string, _token: string): Promise<void> {
    logger.info('Verification email (noop)', { email });
  }
  async sendPasswordResetEmail(email: string, _token: string): Promise<void> {
    logger.info('Password reset email (noop)', { email });
  }
  async sendWelcomeEmail(email: string, _firstName: string): Promise<void> {
    logger.info('Welcome email (noop)', { email });
  }
}

interface Cradle {
  prisma: PrismaClient;
  userRepository: PrismaUserRepository;
  refreshTokenRepository: PrismaRefreshTokenRepository;
  passwordService: Argon2PasswordService;
  emailService: NoopEmailService;
  tokenService: JwtTokenService;
  redisService: RedisService;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  forgotPasswordUseCase: ForgotPasswordUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  getProfileUseCase: GetProfileUseCase;
  updateProfileUseCase: UpdateProfileUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
}

export async function setupContainer(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();

  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: false,
    strictBooleanEnforced: true,
  });

  const tokenService = new JwtTokenService(app);

  diContainer.register({
    prisma: asValue(prisma),
    tokenService: asValue(tokenService),

    redisService: asFunction(() => new RedisService(), { lifetime: Lifetime.SINGLETON }),
    passwordService: asFunction(() => new Argon2PasswordService(), { lifetime: Lifetime.SINGLETON }),
    emailService: asFunction(() => new NoopEmailService(), { lifetime: Lifetime.SINGLETON }),

    userRepository: asFunction(() => new PrismaUserRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    refreshTokenRepository: asFunction(() => new PrismaRefreshTokenRepository(prisma), { lifetime: Lifetime.SINGLETON }),

    registerUseCase: asFunction((c: Cradle) =>
      new RegisterUseCase(c.userRepository, c.passwordService, c.emailService),
    { lifetime: Lifetime.SCOPED }),

    loginUseCase: asFunction((c: Cradle) =>
      new LoginUseCase(c.userRepository, c.refreshTokenRepository, c.passwordService, c.tokenService),
    { lifetime: Lifetime.SCOPED }),

    refreshTokenUseCase: asFunction((c: Cradle) =>
      new RefreshTokenUseCase(c.userRepository, c.refreshTokenRepository, c.tokenService),
    { lifetime: Lifetime.SCOPED }),

    logoutUseCase: asFunction((c: Cradle) =>
      new LogoutUseCase(c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),

    verifyEmailUseCase: asFunction((c: Cradle) =>
      new VerifyEmailUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    forgotPasswordUseCase: asFunction((c: Cradle) =>
      new ForgotPasswordUseCase(c.userRepository, c.emailService),
    { lifetime: Lifetime.SCOPED }),

    resetPasswordUseCase: asFunction((c: Cradle) =>
      new ResetPasswordUseCase(c.userRepository, c.passwordService, c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),

    getProfileUseCase: asFunction((c: Cradle) =>
      new GetProfileUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    updateProfileUseCase: asFunction((c: Cradle) =>
      new UpdateProfileUseCase(c.userRepository),
    { lifetime: Lifetime.SCOPED }),

    changePasswordUseCase: asFunction((c: Cradle) =>
      new ChangePasswordUseCase(c.userRepository, c.passwordService, c.refreshTokenRepository),
    { lifetime: Lifetime.SCOPED }),
  });
}
