import { Request, Response, NextFunction } from 'express';
import { AppError } from '@applybot/shared';
import { createLogger } from './logger';

const logger = createLogger('error-handler');

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.error(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      context: err.context,
    });

    res.status(err.statusCode).json({
      error: err.code,
      message: process.env.NODE_ENV === 'production' ? err.toUserMessage() : err.message,
    });
    return;
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
