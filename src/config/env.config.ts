import { z } from 'zod';

// z.coerce.boolean() appelle Boolean(value) sur la chaîne brute de process.env,
// donc Boolean("false") === true (chaîne non vide) - un piège classique qui
// rendait MINIO_USE_SSL=false toujours vrai. On parse explicitement la chaîne.
const booleanEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v.toLowerCase() === 'true' || v === '1'));

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
  MINIO_USE_SSL: booleanEnv(false),
  // Hôte/port utilisés UNIQUEMENT pour signer les URLs présignées renvoyées au navigateur -
  // distincts de MINIO_ENDPOINT/MINIO_PORT qui servent aux appels serveur->MinIO internes au
  // réseau Docker (ex. "minio", injoignable depuis un navigateur hors conteneur). Vides par
  // défaut : retombent sur MINIO_ENDPOINT/MINIO_PORT si non définis (cas prod où l'API et MinIO
  // partagent un même hôte public).
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().optional(),

  MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
  MEILISEARCH_API_KEY: z.string().default('masterKey'),

  QGIS_SERVER_URL: z.string().default('http://localhost:8380/ows'),
  QGIS_PROJECTS_DIR: z.string().default('/var/www/qgis/projects'),
  QGIS_STYLES_DIR: z.string().default('/var/www/qgis/styles'),
  DATA_DIR: z.string().default('/tmp/geosm-data'),
  NOMINATIM_URL: z.string().default('http://localhost:8081'),
  OSRM_URL: z.string().default('http://localhost:5000'),
  // Import OSM programmé (voir ScheduledOsmImportUseCase) : chemin du fichier .osm.pbf à
  // ré-importer périodiquement (déposé manuellement/par un job externe sur ce chemin - il
  // n'existe pas de téléchargement automatique depuis Geofabrik ou l'API OSM dans ce code).
  // Non défini = le job planifié se déclenche mais ne fait rien (no-op silencieux, loggé).
  OSM_IMPORT_PBF_PATH: z.string().optional(),
  OSM_IMPORT_CRON: z.string().default('0 2 1 * *'),

  // Backup Postgres programmé (voir DatabaseBackupUseCase) - actif par défaut (contrairement
  // à l'import OSM, un backup ne dépend d'aucune configuration externe pour être utile).
  BACKUP_CRON: z.string().default('0 3 * * *'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),

  // Google Gemini (assistant IA) - optionnel : les fonctionnalites IA sont desactivees
  // proprement (erreur explicite a l'appel, pas de crash au demarrage) si absent.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // Authentification via OpenStreetMap (OAuth 2.0, voir OsmOAuthService) - optionnel : le
  // bouton "Se connecter avec OpenStreetMap" est masqué côté frontend si absent, aucun crash
  // au démarrage. OSM_OAUTH_BASE_URL bascule entre l'instance réelle et le sandbox de test
  // (master.apis.dev.openstreetmap.org) sans changer le code.
  OSM_OAUTH_CLIENT_ID: z.string().optional(),
  OSM_OAUTH_CLIENT_SECRET: z.string().optional(),
  OSM_OAUTH_REDIRECT_URI: z.string().optional(),
  OSM_OAUTH_BASE_URL: z.string().default('https://www.openstreetmap.org'),
  // Clé de chiffrement au repos du token OSM (AES-256-GCM, voir encryption.util.ts) - distincte
  // des secrets JWT car un usage différent (chiffrement réversible vs signature).
  ENCRYPTION_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z
    .string()
    .default(
      '__ROTATED_MAPBOX_TOKEN_REMOVED__',
    ),

  LOG_LEVEL: z.string().default('info'),
  PROMETHEUS_ENABLED: booleanEnv(true),

  // Observability
  GRAYLOG_HOST: z.string().optional(),
  GRAYLOG_PORT: z.coerce.number().default(12201),
  SLACK_WEBHOOK_URL: z.string().optional(),
  ALERT_EMAIL_TO: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('geosm-api'),
  GRAFANA_PASSWORD: z.string().optional(),

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
