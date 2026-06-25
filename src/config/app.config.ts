import { config } from './env.config.js';

export const appConfig = {
  name: config.APP_NAME,
  url: config.APP_URL,
  port: config.PORT,
  host: config.HOST,
  apiPrefix: config.API_PREFIX,
  env: config.NODE_ENV,
  isProduction: config.NODE_ENV === 'production',
  isDevelopment: config.NODE_ENV === 'development',
  isTest: config.NODE_ENV === 'test',
  cors: {
    origin: config.CORS_ORIGIN.split(','),
  },
  rateLimit: {
    public: config.RATE_LIMIT_PUBLIC,
    authenticated: config.RATE_LIMIT_AUTHENTICATED,
    admin: config.RATE_LIMIT_ADMIN,
    windowMs: config.RATE_LIMIT_WINDOW_MS,
  },
  logging: {
    level: config.LOG_LEVEL,
  },
  prometheus: {
    enabled: config.PROMETHEUS_ENABLED,
  },
};
