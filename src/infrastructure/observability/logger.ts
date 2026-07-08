import winston from 'winston';
import os from 'os';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

// Custom format that adds correlation metadata
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
);

const consoleFormat = isProduction
  ? winston.format.combine(baseFormat, winston.format.json())
  : winston.format.combine(
      baseFormat,
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, module, correlationId, ...rest }) => {
        const mod = module ? `[${module}]` : '';
        const cid = correlationId ? `(${correlationId})` : '';
        const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} ${level} ${mod}${cid} ${message}${extra}`;
      }),
    );

const transports: winston.transport[] = [new winston.transports.Console({ format: consoleFormat })];

// File transports with daily rotation (only if winston-daily-rotate-file is available)
try {
  // Dynamic import at module level — the require is fine here since this runs at startup
  const DailyRotateFile = (await import('winston-daily-rotate-file')).default;

  transports.push(
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(baseFormat, winston.format.json()),
    }),
  );

  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(baseFormat, winston.format.json()),
    }),
  );
} catch {
  // winston-daily-rotate-file not installed, skip file transports
}

// GELF transport for Graylog
const graylogHost = process.env.GRAYLOG_HOST;
const graylogPort = parseInt(process.env.GRAYLOG_PORT || '12201', 10);

if (graylogHost) {
  try {
    const gelfPro = (await import('gelf-pro')).default;
    gelfPro.setConfig({
      adapterName: 'udp',
      adapterOptions: {
        host: graylogHost,
        port: graylogPort,
      },
    });

    // Custom GELF transport
    const TransportBase = winston.transports.Console.constructor as new (
      opts?: Record<string, unknown>,
    ) => winston.transport;
    class GelfTransport extends TransportBase {
      log(info: Record<string, unknown>, callback: () => void): void {
        const { level, message, ...meta } = info;
        const gelfLevel = level === 'error' ? 3 : level === 'warn' ? 4 : level === 'info' ? 6 : 7;
        gelfPro.message(String(message), gelfLevel, meta);
        callback();
      }
    }

    transports.push(new GelfTransport() as winston.transport);
  } catch {
    // gelf-pro not installed, skip GELF transport
  }
}

const defaultMeta = {
  service: 'geosm-api',
  environment: process.env.NODE_ENV || 'development',
  hostname: os.hostname(),
  pid: process.pid,
};

export const logger = winston.createLogger({
  level: logLevel,
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  defaultMeta,
  transports,
});

// Add custom colors for non-production
if (!isProduction) {
  winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  });
}

/**
 * Create a child logger with a module name and optional correlation ID.
 */
export function createChildLogger(module: string, correlationId?: string): winston.Logger {
  return logger.child({ module, ...(correlationId ? { correlationId } : {}) });
}
