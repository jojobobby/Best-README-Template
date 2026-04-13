import Bull from 'bull';
import { prisma } from '@applybot/db';
import {
  WorkerEnv,
  createQueue,
  QUEUE_APPLY,
  ApplyJobPayload,
  loadIdentity,
  Identity,
  CaptchaDetectedError,
  LoginRequiredError,
  closeAllQueues,
} from '@applybot/shared';
import { acquireBrowser, createContext, setPoolSize, closeAllBrowsers } from './agent/browser';
import { captureScreenshot } from './agent/screenshot';
import { clearFormCache } from './agent/form-detector';
import { applyGreenhouseJob } from './platforms/greenhouse';
import { applyLeverJob } from './platforms/lever';
import { applyWorkdayJob } from './platforms/workday';
import { applyGenericJob } from './platforms/generic';
import { createWorkerLogger } from './logger';
import { initWorkerSms, notifyApplySuccess, notifyApplyFailure, notifyApplySkipped } from './sms-notify';

const logger = createWorkerLogger('worker');

let cachedIdentity: Identity | null = null;
let identityLoadedAt = 0;
const IDENTITY_CACHE_TTL = 5 * 60 * 1000;

async function getIdentity(env: WorkerEnv): Promise<Identity> {
  const now = Date.now();
  if (cachedIdentity && now - identityLoadedAt < IDENTITY_CACHE_TTL) {
    return cachedIdentity;
  }

  const identityDir = env.IDENTITY_PATH.replace(/\/[^/]+$/, '');
  cachedIdentity = await loadIdentity(identityDir, env.IDENTITY_KEY);
  identityLoadedAt = now;

  logger.info('Identity loaded', {
    name: `${cachedIdentity.firstName} ${cachedIdentity.lastName}`,
  });

  return cachedIdentity;
}

export async function startWorker(env: WorkerEnv): Promise<Bull.Queue> {
  setPoolSize(env.BROWSER_POOL_SIZE);
  initWorkerSms(env);

  const queue = createQueue(QUEUE_APPLY, env.REDIS_URL);

  queue.process(1, async (job: Bull.Job<ApplyJobPayload>) => {
    const { jobId } = job.data;
    const startTime = Date.now();

    logger.info('Processing apply job', { jobId });

    // Load job from DB
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (!dbJob) {
      logger.warn('Job not found', { jobId });
      return;
    }

    if (dbJob.status !== 'APPROVED') {
      logger.info('Job not in APPROVED status, skipping', { jobId, status: dbJob.status });
      return;
    }

    // Update status to APPLYING
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'APPLYING' },
    });

    // Load identity
    const identity = await getIdentity(env);

    // Log step helper — type-safe with ApplicationStepType
    const logStep: import('@applybot/shared').LogStepFn = async (step, status, details, durationMs) => {
      await prisma.applicationLog.create({
        data: {
          jobId,
          step,
          status,
          details,
          durationMs,
        },
      });
    };

    let browser;
    let context;
    let page;

    try {
      // Launch browser
      browser = await acquireBrowser(env.HEADLESS, env.PLAYWRIGHT_CHROMIUM_ARGS);
      context = await createContext(browser);
      page = await context.newPage();

      // Detect platform from URL
      const url = dbJob.applyUrl;
      let platform: string;

      if (url.includes('greenhouse.io')) {
        platform = 'greenhouse';
      } else if (url.includes('lever.co')) {
        platform = 'lever';
      } else if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) {
        platform = 'workday';
      } else {
        platform = 'generic';
      }

      logger.info('Platform detected', { jobId, platform, url });

      const jobData = {
        id: dbJob.id,
        title: dbJob.title,
        company: dbJob.company,
        description: dbJob.description,
        applyUrl: dbJob.applyUrl,
      };

      let result;

      switch (platform) {
        case 'greenhouse':
          result = await applyGreenhouseJob(
            page, jobData, identity, logStep, env.ANTHROPIC_API_KEY, env.RESUME_PATH,
          );
          break;
        case 'lever':
          result = await applyLeverJob(
            page, jobData, identity, logStep, env.ANTHROPIC_API_KEY, env.RESUME_PATH,
          );
          break;
        case 'workday':
          result = await applyWorkdayJob(
            page, jobData, identity, logStep, env.ANTHROPIC_API_KEY, env.RESUME_PATH,
            env.WORKDAY_EMAIL, env.WORKDAY_PASSWORD,
          );
          break;
        default:
          result = await applyGenericJob(
            page, jobData, identity, logStep, env.ANTHROPIC_API_KEY, env.RESUME_PATH,
            env.TWOCAPTCHA_API_KEY,
          );
      }

      // Take screenshot
      const screenshotPath = await captureScreenshot(page, jobId, env.SCREENSHOT_DIR);
      await logStep('SCREENSHOT', 'SUCCESS', screenshotPath || 'No screenshot');

      if (result.success) {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'APPLIED', appliedAt: new Date() },
        });

        // Notify user of success via SMS
        await notifyApplySuccess(dbJob.title, dbJob.company);

        logger.info('Application successful', {
          jobId,
          platform,
          durationMs: Date.now() - startTime,
        });
      } else {
        throw new Error(result.error || 'Apply returned success=false');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Take screenshot on failure
      if (page) {
        await captureScreenshot(page, jobId, env.SCREENSHOT_DIR).catch(() => {});
      }

      // Handle specific errors
      if (err instanceof CaptchaDetectedError) {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'SKIPPED', hasCaptcha: true, failureReason: errorMessage },
        });
        await logStep('FILL_FORM', 'SKIPPED', 'CAPTCHA detected');
        await notifyApplySkipped(dbJob.title, dbJob.company, 'CAPTCHA detected, needs manual apply');
        return; // Don't retry
      }

      if (err instanceof LoginRequiredError) {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'SKIPPED', requiresLogin: true, failureReason: errorMessage },
        });
        await logStep('LOGIN', 'SKIPPED', 'Login required');
        await notifyApplySkipped(dbJob.title, dbJob.company, 'login required');
        return; // Don't retry
      }

      // Update retry count
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          retryCount: { increment: 1 },
          failureReason: errorMessage,
        },
      });

      if (updatedJob.retryCount >= env.MAX_RETRIES) {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'FAILED' },
        });

        // Notify user of permanent failure
        await notifyApplyFailure(dbJob.title, dbJob.company, errorMessage);

        logger.error('Apply permanently failed after max retries', {
          jobId,
          retryCount: updatedJob.retryCount,
          error: errorMessage,
        });
      } else {
        // Reset to APPROVED for retry
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'APPROVED' },
        });

        // Re-throw to trigger Bull retry with backoff
        throw err;
      }
    } finally {
      // Clean up browser context and form cache for this job
      if (context) {
        await context.close().catch(() => {});
      }
      clearFormCache();
    }
  });

  queue.on('failed', (job, err) => {
    logger.error('Apply job failed', {
      jobId: job.data.jobId,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  queue.on('completed', (job) => {
    logger.info('Apply job completed', { jobId: job.data.jobId });
  });

  logger.info('Apply worker started', { concurrency: 1, poolSize: env.BROWSER_POOL_SIZE });
  return queue;
}
