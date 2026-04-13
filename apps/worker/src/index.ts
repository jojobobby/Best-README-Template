import { validateEnv, workerEnvSchema } from '@applybot/shared';
import { prisma } from '@applybot/db';
import { createWorkerLogger } from './logger';
import { startWorker } from './worker';

const logger = createWorkerLogger('main');

const BANNER = `
    _                _       ____        _
   / \\   _ __  _ __ | |_   _| __ )  ___ | |_
  / _ \\ | '_ \\| '_ \\| | | | |  _ \\ / _ \\| __|
 / ___ \\| |_) | |_) | | |_| | |_) | (_) | |_
/_/   \\_\\ .__/| .__/|_|\\__, |____/ \\___/ \\__|
        |_|   |_|      |___/
        v1.0.0 — Apply Worker Agent
`;

async function main() {
  console.log(BANNER);

  const env = validateEnv(workerEnvSchema);
  logger.info('Environment validated successfully');

  await prisma.$connect();
  logger.info('Database connected');

  const worker = await startWorker(env);
  logger.info('Worker started, waiting for apply jobs...');

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await worker.close();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
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
