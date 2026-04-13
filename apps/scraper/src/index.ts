import { validateEnv, scraperEnvSchema } from '@applybot/shared';
import { prisma } from '@applybot/db';
import { createScraperLogger } from './logger';
import { startScheduler } from './scheduler';

const logger = createScraperLogger('main');

const BANNER = `
    _                _       ____        _
   / \\   _ __  _ __ | |_   _| __ )  ___ | |_
  / _ \\ | '_ \\| '_ \\| | | | |  _ \\ / _ \\| __|
 / ___ \\| |_) | |_) | | |_| | |_) | (_) | |_
/_/   \\_\\ .__/| .__/|_|\\__, |____/ \\___/ \\__|
        |_|   |_|      |___/
        v1.0.0 — Job Scraper Service
`;

async function main() {
  console.log(BANNER);

  const env = validateEnv(scraperEnvSchema);
  logger.info('Environment validated successfully');

  await prisma.$connect();
  logger.info('Database connected');

  const scheduler = startScheduler(env);
  logger.info(`Scraper scheduler started (interval: ${env.SCRAPE_INTERVAL_MINUTES}min)`);

  if (env.SCRAPE_ON_START) {
    logger.info('SCRAPE_ON_START enabled, running initial scrape...');
    scheduler.runNow();
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    scheduler.stop();
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
