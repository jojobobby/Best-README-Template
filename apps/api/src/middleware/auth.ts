import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function apiKeyAuth(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.headers['x-api-key'] as string | undefined;

    if (!provided || !safeCompare(provided, apiKey)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid X-API-Key header',
      });
      return;
    }

    next();
  };
}
