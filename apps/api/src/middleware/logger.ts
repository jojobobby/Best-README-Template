import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

const SENSITIVE_FIELDS = ['password', 'token', 'key', 'secret', 'authorization', 'cookie'];

function scrubSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f))) {
      scrubbed[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      scrubbed[k] = scrubSensitive(v as Record<string, unknown>);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

export function createLogger(service: string) {
  const isProduction = process.env.NODE_ENV === 'production';

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service },
    format: isProduction
      ? winston.format.combine(winston.format.timestamp(), winston.format.json())
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service: svc, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(scrubSensitive(meta))}` : '';
            return `${timestamp} [${svc}] ${level}: ${message}${metaStr}`;
          }),
        ),
    transports: [
      new winston.transports.Console(),
      ...(process.env.LOG_TO_FILE === 'true'
        ? [
            new winston.transports.File({
              filename: '/var/log/applybot/api.log',
              maxsize: 10 * 1024 * 1024,
              maxFiles: 5,
            }),
          ]
        : []),
    ],
  });
}

const logger = createLogger('api');

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = uuid();
    const start = Date.now();

    (req as unknown as Record<string, unknown>).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('request', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      });
    });

    next();
  };
}
