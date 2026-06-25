import { PrismaClient } from '@prisma/client';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, asValue, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';

import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/repositories/prisma-refresh-token.repository.js';
import { PrismaInstanceRepository } from './infrastructure/database/repositories/prisma-instance.repository.js';
import { PrismaGroupRepository } from './infrastructure/database/repositories/prisma-group.repository.js';
import { PrismaSubGroupRepository } from './infrastructure/database/repositories/prisma-sub-group.repository.js';
import { PrismaLayerRepository } from './infrastructure/database/repositories/prisma-layer.repository.js';
import { PrismaBaseMapRepository } from './infrastructure/database/repositories/prisma-base-map.repository.js';
import { Argon2PasswordService } from './infrastructure/auth/argon2-password.service.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token.service.js';
import { RedisService } from './infrastructure/cache/redis.service.js';

// Auth use cases
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

// Users use cases
import { ListUsersUseCase } from './application/use-cases/users/list-users.use-case.js';
import { GetUserUseCase } from './application/use-cases/users/get-user.use-case.js';
import { CreateUserUseCase } from './application/use-cases/users/create-user.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/users/update-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/users/delete-user.use-case.js';
import { ChangeUserRoleUseCase } from './application/use-cases/users/change-user-role.use-case.js';
import { ToggleUserActiveUseCase } from './application/use-cases/users/toggle-user-active.use-case.js';

// Instances use cases
import { ListInstancesUseCase } from './application/use-cases/instances/list-instances.use-case.js';
import { GetInstanceUseCase } from './application/use-cases/instances/get-instance.use-case.js';
import { CreateInstanceUseCase } from './application/use-cases/instances/create-instance.use-case.js';
import { UpdateInstanceUseCase } from './application/use-cases/instances/update-instance.use-case.js';
import { DeleteInstanceUseCase } from './application/use-cases/instances/delete-instance.use-case.js';
import { GetInstanceUsersUseCase } from './application/use-cases/instances/get-instance-users.use-case.js';
import { AddInstanceUserUseCase } from './application/use-cases/instances/add-instance-user.use-case.js';
import { RemoveInstanceUserUseCase } from './application/use-cases/instances/remove-instance-user.use-case.js';
import { ChangeInstanceUserRoleUseCase } from './application/use-cases/instances/change-instance-user-role.use-case.js';

// Groups use cases
import { ListGroupsUseCase } from './application/use-cases/groups/list-groups.use-case.js';
import { GetGroupUseCase } from './application/use-cases/groups/get-group.use-case.js';
import { CreateGroupUseCase } from './application/use-cases/groups/create-group.use-case.js';
import { UpdateGroupUseCase } from './application/use-cases/groups/update-group.use-case.js';
import { DeleteGroupUseCase } from './application/use-cases/groups/delete-group.use-case.js';
import { ReorderGroupsUseCase } from './application/use-cases/groups/reorder-groups.use-case.js';

// SubGroups use cases
import { ListSubGroupsUseCase } from './application/use-cases/sub-groups/list-sub-groups.use-case.js';
import { GetSubGroupUseCase } from './application/use-cases/sub-groups/get-sub-group.use-case.js';
import { CreateSubGroupUseCase } from './application/use-cases/sub-groups/create-sub-group.use-case.js';
import { UpdateSubGroupUseCase } from './application/use-cases/sub-groups/update-sub-group.use-case.js';
import { DeleteSubGroupUseCase } from './application/use-cases/sub-groups/delete-sub-group.use-case.js';

// Layers use cases
import { ListLayersUseCase } from './application/use-cases/layers/list-layers.use-case.js';
import { GetLayerUseCase } from './application/use-cases/layers/get-layer.use-case.js';
import { CreateLayerUseCase } from './application/use-cases/layers/create-layer.use-case.js';
import { UpdateLayerUseCase } from './application/use-cases/layers/update-layer.use-case.js';
import { DeleteLayerUseCase } from './application/use-cases/layers/delete-layer.use-case.js';

// BaseMaps use cases
import { ListBaseMapsUseCase } from './application/use-cases/base-maps/list-base-maps.use-case.js';
import { CreateBaseMapUseCase } from './application/use-cases/base-maps/create-base-map.use-case.js';
import { UpdateBaseMapUseCase } from './application/use-cases/base-maps/update-base-map.use-case.js';
import { DeleteBaseMapUseCase } from './application/use-cases/base-maps/delete-base-map.use-case.js';

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
  instanceRepository: PrismaInstanceRepository;
  groupRepository: PrismaGroupRepository;
  subGroupRepository: PrismaSubGroupRepository;
  layerRepository: PrismaLayerRepository;
  baseMapRepository: PrismaBaseMapRepository;
  passwordService: Argon2PasswordService;
  emailService: NoopEmailService;
  tokenService: JwtTokenService;
  redisService: RedisService;
  // Auth
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
  // Users
  listUsersUseCase: ListUsersUseCase;
  getUserUseCase: GetUserUseCase;
  createUserUseCase: CreateUserUseCase;
  updateUserUseCase: UpdateUserUseCase;
  deleteUserUseCase: DeleteUserUseCase;
  changeUserRoleUseCase: ChangeUserRoleUseCase;
  toggleUserActiveUseCase: ToggleUserActiveUseCase;
  // Instances
  listInstancesUseCase: ListInstancesUseCase;
  getInstanceUseCase: GetInstanceUseCase;
  createInstanceUseCase: CreateInstanceUseCase;
  updateInstanceUseCase: UpdateInstanceUseCase;
  deleteInstanceUseCase: DeleteInstanceUseCase;
  getInstanceUsersUseCase: GetInstanceUsersUseCase;
  addInstanceUserUseCase: AddInstanceUserUseCase;
  removeInstanceUserUseCase: RemoveInstanceUserUseCase;
  changeInstanceUserRoleUseCase: ChangeInstanceUserRoleUseCase;
  // Groups
  listGroupsUseCase: ListGroupsUseCase;
  getGroupUseCase: GetGroupUseCase;
  createGroupUseCase: CreateGroupUseCase;
  updateGroupUseCase: UpdateGroupUseCase;
  deleteGroupUseCase: DeleteGroupUseCase;
  reorderGroupsUseCase: ReorderGroupsUseCase;
  // SubGroups
  listSubGroupsUseCase: ListSubGroupsUseCase;
  getSubGroupUseCase: GetSubGroupUseCase;
  createSubGroupUseCase: CreateSubGroupUseCase;
  updateSubGroupUseCase: UpdateSubGroupUseCase;
  deleteSubGroupUseCase: DeleteSubGroupUseCase;
  // Layers
  listLayersUseCase: ListLayersUseCase;
  getLayerUseCase: GetLayerUseCase;
  createLayerUseCase: CreateLayerUseCase;
  updateLayerUseCase: UpdateLayerUseCase;
  deleteLayerUseCase: DeleteLayerUseCase;
  // BaseMaps
  listBaseMapsUseCase: ListBaseMapsUseCase;
  createBaseMapUseCase: CreateBaseMapUseCase;
  updateBaseMapUseCase: UpdateBaseMapUseCase;
  deleteBaseMapUseCase: DeleteBaseMapUseCase;
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

    // Repositories
    userRepository: asFunction(() => new PrismaUserRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    refreshTokenRepository: asFunction(() => new PrismaRefreshTokenRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    instanceRepository: asFunction(() => new PrismaInstanceRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    groupRepository: asFunction(() => new PrismaGroupRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    subGroupRepository: asFunction(() => new PrismaSubGroupRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    layerRepository: asFunction(() => new PrismaLayerRepository(prisma), { lifetime: Lifetime.SINGLETON }),
    baseMapRepository: asFunction(() => new PrismaBaseMapRepository(prisma), { lifetime: Lifetime.SINGLETON }),

    // Auth use cases
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

    // Users use cases
    listUsersUseCase: asFunction((c: Cradle) => new ListUsersUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    getUserUseCase: asFunction((c: Cradle) => new GetUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    createUserUseCase: asFunction((c: Cradle) => new CreateUserUseCase(c.userRepository, c.passwordService), { lifetime: Lifetime.SCOPED }),
    updateUserUseCase: asFunction((c: Cradle) => new UpdateUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    deleteUserUseCase: asFunction((c: Cradle) => new DeleteUserUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    changeUserRoleUseCase: asFunction((c: Cradle) => new ChangeUserRoleUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),
    toggleUserActiveUseCase: asFunction((c: Cradle) => new ToggleUserActiveUseCase(c.userRepository), { lifetime: Lifetime.SCOPED }),

    // Instances use cases
    listInstancesUseCase: asFunction((c: Cradle) => new ListInstancesUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    getInstanceUseCase: asFunction((c: Cradle) => new GetInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    createInstanceUseCase: asFunction((c: Cradle) => new CreateInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateInstanceUseCase: asFunction((c: Cradle) => new UpdateInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    deleteInstanceUseCase: asFunction((c: Cradle) => new DeleteInstanceUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    getInstanceUsersUseCase: asFunction((c: Cradle) => new GetInstanceUsersUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    addInstanceUserUseCase: asFunction((c: Cradle) => new AddInstanceUserUseCase(c.instanceRepository, c.userRepository), { lifetime: Lifetime.SCOPED }),
    removeInstanceUserUseCase: asFunction((c: Cradle) => new RemoveInstanceUserUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    changeInstanceUserRoleUseCase: asFunction((c: Cradle) => new ChangeInstanceUserRoleUseCase(c.instanceRepository), { lifetime: Lifetime.SCOPED }),

    // Groups use cases
    listGroupsUseCase: asFunction((c: Cradle) => new ListGroupsUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    getGroupUseCase: asFunction((c: Cradle) => new GetGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    createGroupUseCase: asFunction((c: Cradle) => new CreateGroupUseCase(c.groupRepository, c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateGroupUseCase: asFunction((c: Cradle) => new UpdateGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    deleteGroupUseCase: asFunction((c: Cradle) => new DeleteGroupUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),
    reorderGroupsUseCase: asFunction((c: Cradle) => new ReorderGroupsUseCase(c.groupRepository), { lifetime: Lifetime.SCOPED }),

    // SubGroups use cases
    listSubGroupsUseCase: asFunction((c: Cradle) => new ListSubGroupsUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    getSubGroupUseCase: asFunction((c: Cradle) => new GetSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    createSubGroupUseCase: asFunction((c: Cradle) => new CreateSubGroupUseCase(c.subGroupRepository, c.groupRepository), { lifetime: Lifetime.SCOPED }),
    updateSubGroupUseCase: asFunction((c: Cradle) => new UpdateSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),
    deleteSubGroupUseCase: asFunction((c: Cradle) => new DeleteSubGroupUseCase(c.subGroupRepository), { lifetime: Lifetime.SCOPED }),

    // Layers use cases
    listLayersUseCase: asFunction((c: Cradle) => new ListLayersUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),
    getLayerUseCase: asFunction((c: Cradle) => new GetLayerUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),
    createLayerUseCase: asFunction((c: Cradle) => new CreateLayerUseCase(c.layerRepository, c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateLayerUseCase: asFunction((c: Cradle) => new UpdateLayerUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),
    deleteLayerUseCase: asFunction((c: Cradle) => new DeleteLayerUseCase(c.layerRepository), { lifetime: Lifetime.SCOPED }),

    // BaseMaps use cases
    listBaseMapsUseCase: asFunction((c: Cradle) => new ListBaseMapsUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),
    createBaseMapUseCase: asFunction((c: Cradle) => new CreateBaseMapUseCase(c.baseMapRepository, c.instanceRepository), { lifetime: Lifetime.SCOPED }),
    updateBaseMapUseCase: asFunction((c: Cradle) => new UpdateBaseMapUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),
    deleteBaseMapUseCase: asFunction((c: Cradle) => new DeleteBaseMapUseCase(c.baseMapRepository), { lifetime: Lifetime.SCOPED }),
  });
}
