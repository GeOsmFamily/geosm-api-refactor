import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from '../../../../src/presentation/routes/auth.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';

const JWT_SECRET = 'test-secret-key-for-integration-tests';

function mockUseCase(result: unknown = { id: '1' }) {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function buildApp(): FastifyInstance {
  const app = Fastify();

  app.setErrorHandler(errorHandler);

  // Register JWT
  app.register(fastifyJwt, { secret: JWT_SECRET });

  // Decorate authenticate
  app.decorate('authenticate', async function (request: any, _reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });

  // Mock DI container
  const useCases: Record<string, any> = {
    registerUseCase: mockUseCase({ id: 'user-1', email: 'test@test.com' }),
    loginUseCase: mockUseCase({ accessToken: 'tok', refreshToken: 'ref' }),
    refreshTokenUseCase: mockUseCase({ accessToken: 'new-tok', refreshToken: 'new-ref' }),
    logoutUseCase: mockUseCase(null),
    verifyEmailUseCase: mockUseCase(null),
    forgotPasswordUseCase: mockUseCase(null),
    resetPasswordUseCase: mockUseCase(null),
    getProfileUseCase: mockUseCase({ id: 'user-1', email: 'test@test.com' }),
    updateProfileUseCase: mockUseCase({ id: 'user-1', firstName: 'Updated' }),
    changePasswordUseCase: mockUseCase(null),
  };

  app.decorate('diContainer', {
    resolve: (name: string) => useCases[name],
  });

  app.register(authRoutes);

  return app;
}

function generateToken(app: FastifyInstance): string {
  return app.jwt.sign({ sub: 'user-1', email: 'test@test.com', role: 'VIEWER' });
}

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- POST /register ---
  describe('POST /register', () => {
    it('should register with valid data (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { email: 'new@test.com', password: 'password123', firstName: 'John', lastName: 'Doe' },
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject invalid email (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { email: 'not-an-email', password: 'password123', firstName: 'John', lastName: 'Doe' },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should reject short password (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { email: 'test@test.com', password: 'short', firstName: 'John', lastName: 'Doe' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject missing fields (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { email: 'test@test.com' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // --- POST /login ---
  describe('POST /login', () => {
    it('should login with valid credentials (200)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'test@test.com', password: 'password123' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
    });

    it('should reject invalid email format (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'bad', password: 'password123' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject empty password (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'test@test.com', password: '' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // --- POST /refresh ---
  describe('POST /refresh', () => {
    it('should refresh with valid token (200)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject non-uuid refreshToken (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: 'not-a-uuid' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // --- GET /me (authenticated) ---
  describe('GET /me', () => {
    it('should return profile when authenticated (200)', async () => {
      const token = generateToken(app);
      const response = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject unauthenticated request (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid token (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: 'Bearer invalid-token' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- PATCH /me (authenticated) ---
  describe('PATCH /me', () => {
    it('should update profile when authenticated (200)', async () => {
      const token = generateToken(app);
      const response = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { firstName: 'Updated' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject unauthenticated request (401)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/me',
        payload: { firstName: 'Updated' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- PUT /me/password (authenticated) ---
  describe('PUT /me/password', () => {
    it('should change password when authenticated (200)', async () => {
      const token = generateToken(app);
      const response = await app.inject({
        method: 'PUT',
        url: '/me/password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'oldpass123', newPassword: 'newpass1234' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject short new password (400)', async () => {
      const token = generateToken(app);
      const response = await app.inject({
        method: 'PUT',
        url: '/me/password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'oldpass123', newPassword: 'short' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject unauthenticated request (401)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/me/password',
        payload: { currentPassword: 'oldpass123', newPassword: 'newpass1234' },
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
