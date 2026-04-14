import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ApiEnv } from '@applybot/shared';
import { smsRouter } from './routes/sms';
import { jobsRouter } from './routes/jobs';
import { healthRouter } from './routes/health';
import { adminRouter } from './routes/admin';
import { metricsRouter } from './routes/metrics';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupBullBoard } from './services/bullboard';

export function createServer(env: ApiEnv): Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(cors());

  // Parse URL-encoded bodies (for Twilio webhooks)
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Request logging
  app.use(requestLogger());

  // Health check (no auth)
  app.use('/health', healthRouter());

  // Metrics (token-protected)
  app.use('/metrics', metricsRouter(env));

  // Twilio SMS webhook (rate-limited, signature-validated inside route)
  const smsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many requests',
  });
  app.use('/webhook/sms', smsLimiter, smsRouter(env));

  // Bull Board dashboard
  if (env.BULL_BOARD_USER && env.BULL_BOARD_PASS) {
    app.use('/admin/bull', setupBullBoard(env));
  }

  // Protected routes
  app.use('/jobs', jobsRouter(env));
  app.use('/admin', adminRouter(env));

  // Error handler
  app.use(errorHandler);

  return app;
}
