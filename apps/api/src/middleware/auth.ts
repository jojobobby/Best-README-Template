import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.headers['x-api-key'] as string | undefined;

    if (!provided || provided !== apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid X-API-Key header',
      });
      return;
    }

    next();
  };
}
