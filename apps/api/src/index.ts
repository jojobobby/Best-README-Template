import { createServer } from './server';
import { validateEnv, apiEnvSchema, closeAllQueues } from '@applybot/shared';
import { prisma } from '@applybot/db';
import { createLogger } from './middleware/logger';
import { initQueues } from './services/queue';
import { initTwilio } from './services/twilio';
import { startNotifierWorker } from './jobs/notifier';
import { startQueueDepthCollector } from './services/metrics';
import { getIdentity } from './services/identity';

const logger = createLogger('api');

const BANNER = `
    _                _       ____        _
   / \\   _ __  _ __ | |_   _| __ )  ___ | |_
  / _ \\ | '_ \\| '_ \\| | | | |  _ \\ / _ \\| __|
 / ___ \\| |_) | |_) | | |_| | |_) | (_) | |_
/_/   \\_\\ .__/| .__/|_|\\__, |____/ \\___/ \\__|
        |_|   |_|      |___/
        v1.0.0 — AI-Powered Job Auto-Apply
`;

async function main() {
  console.log(BANNER);

  const env = validateEnv(apiEnvSchema);
  logger.info('Environment validated successfully');

  await prisma.$connect();
  logger.info('Database connected');

  // Initialize queues and register error handlers
  initQueues(env.REDIS_URL);
  logger.info('Queues initialized');

  // Initialize Twilio SMS client
  initTwilio(env);
  logger.info('Twilio client initialized');

  // Start the notifier worker (processes SMS notification queue)
  startNotifierWorker(env.REDIS_URL);
  logger.info('Notifier worker started');

  // Start Prometheus queue depth collector
  startQueueDepthCollector(env.REDIS_URL);

  // Pre-load identity to verify decryption works
  try {
    const identity = await getIdentity(env.IDENTITY_PATH, env.IDENTITY_KEY);
    logger.info(`Identity loaded: ${identity.firstName} ${identity.lastName}`);
  } catch (err) {
    logger.warn('Identity not available at startup (will retry on demand)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const app = createServer(env);

  const server = app.listen(env.PORT, () => {
    logger.info(`API server listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await closeAllQueues();
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
