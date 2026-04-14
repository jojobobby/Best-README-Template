import cron from 'node-cron';
import { prisma, JobSource } from '@applybot/db';
import { ScraperEnv, JobCreateInput, enqueueNotify } from '@applybot/shared';
import { scrapeAdzuna } from './scrapers/adzuna';
import { scrapeGreenhouse } from './scrapers/greenhouse';
import { scrapeLever } from './scrapers/lever';
import { filterNewJobs } from './filters/dedup';
import { filterRelevant } from './filters/relevance';
import { createScraperLogger } from './logger';

const logger = createScraperLogger('scheduler');

interface Scheduler {
  stop: () => void;
  runNow: () => void;
}

export function startScheduler(env: ScraperEnv): Scheduler {
  let running = false;

  async function runAllScrapers() {
    if (running) {
      logger.warn('Scraper run already in progress, skipping');
      return;
    }

    running = true;
    logger.info('Starting scraper run');

    try {
      // Adzuna
      await runScraper('ADZUNA', async () => {
        const raw = await scrapeAdzuna(
          env.ADZUNA_APP_ID,
          env.ADZUNA_APP_KEY,
          env.SEARCH_KEYWORDS,
          env.SEARCH_LOCATION,
        );
        return filterRelevant(raw, env.SEARCH_KEYWORDS, env.EXCLUDE_KEYWORDS);
      });

      // Greenhouse
      if (env.GREENHOUSE_COMPANY_SLUGS.length > 0) {
        await runScraper('GREENHOUSE', async () => {
          const raw = await scrapeGreenhouse(env.GREENHOUSE_COMPANY_SLUGS);
          return filterRelevant(raw, env.SEARCH_KEYWORDS, env.EXCLUDE_KEYWORDS);
        });
      }

      // Lever
      if (env.LEVER_COMPANY_SLUGS.length > 0) {
        await runScraper('LEVER', async () => {
          const raw = await scrapeLever(env.LEVER_COMPANY_SLUGS);
          return filterRelevant(raw, env.SEARCH_KEYWORDS, env.EXCLUDE_KEYWORDS);
        });
      }

      logger.info('Scraper run complete');
    } finally {
      running = false;
    }
  }

  async function runScraper(source: string, fetchFn: () => Promise<JobCreateInput[]>) {
    const startTime = Date.now();
    let jobsFound = 0;
    let jobsNew = 0;
    let jobsDuplicate = 0;
    let errors: string | null = null;

    try {
      const jobs = await fetchFn();
      jobsFound = jobs.length;

      const { newJobs, duplicateCount } = await filterNewJobs(jobs);
      jobsDuplicate = duplicateCount;

      for (const job of newJobs) {
        const created = await prisma.job.create({
          data: {
            sourceId: job.sourceId,
            source: job.source as JobSource,
            title: job.title,
            company: job.company,
            location: job.location ?? null,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
            salaryCurrency: job.salaryCurrency ?? 'USD',
            description: job.description,
            applyUrl: job.applyUrl,
            requiresLogin: job.requiresLogin ?? false,
            hasCaptcha: job.hasCaptcha ?? false,
            status: 'PENDING_REVIEW',
          },
        });

        await enqueueNotify(created.id);
        jobsNew++;
      }

      logger.info(`${source} scraper finished`, { jobsFound, jobsNew, jobsDuplicate });
    } catch (err) {
      errors = err instanceof Error ? err.message : String(err);
      logger.error(`${source} scraper failed`, { error: errors });
    }

    await prisma.scraperRun.create({
      data: {
        source: source as JobSource,
        jobsFound,
        jobsNew,
        jobsDuplicate,
        errors,
        durationMs: Date.now() - startTime,
        ranAt: new Date(),
      },
    });
  }

  const cronExpression = `*/${env.SCRAPE_INTERVAL_MINUTES} * * * *`;
  const task = cron.schedule(cronExpression, () => {
    runAllScrapers().catch((err) => {
      logger.error('Scheduled scraper run failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return {
    stop: () => {
      task.stop();
      logger.info('Scheduler stopped');
    },
    runNow: () => {
      runAllScrapers().catch((err) => {
        logger.error('Manual scraper run failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    },
  };
}
