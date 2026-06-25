import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('GeOSM API'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),

  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  ARGON2_MEMORY_COST: z.coerce.number().default(65536),
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(4),

  RATE_LIMIT_PUBLIC: z.coerce.number().default(10),
  RATE_LIMIT_AUTHENTICATED: z.coerce.number().default(100),
  RATE_LIMIT_ADMIN: z.coerce.number().default(1000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@geosm.org'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minio_access'),
  MINIO_SECRET_KEY: z.string().default('minio_secret'),
  MINIO_BUCKET: z.string().default('geosm'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
  MEILISEARCH_API_KEY: z.string().default('masterKey'),

  QGIS_SERVER_URL: z.string().default('http://localhost:8380/ows'),
  QGIS_PROJECTS_DIR: z.string().default('/var/www/qgis/projects'),
  QGIS_STYLES_DIR: z.string().default('/var/www/qgis/styles'),
  DATA_DIR: z.string().default('/tmp/geosm-data'),
  NOMINATIM_URL: z.string().default('http://localhost:8081'),
  OSRM_URL: z.string().default('http://localhost:5000'),

  LOG_LEVEL: z.string().default('info'),
  PROMETHEUS_ENABLED: z.coerce.boolean().default(true),

  SUPER_ADMIN_EMAIL: z.string().default('admin@geosm.org'),
  SUPER_ADMIN_PASSWORD: z.string().default('AdminP@ssw0rd!'),
  SUPER_ADMIN_FIRST_NAME: z.string().default('Super'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Admin'),

  CORS_ORIGIN: z.string().default('http://localhost:4200'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const message = `Invalid environment variables: ${JSON.stringify(formatted, null, 2)}`;
    throw new Error(message);
  }
  return result.data;
}

export const config = loadConfig();
