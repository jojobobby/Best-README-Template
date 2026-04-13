import { Page } from 'playwright';
import { Identity, LogStepFn, ApplyResult, CaptchaDetectedError, LoginRequiredError } from '@applybot/shared';
import { detectFormFields } from '../agent/form-detector';
import { buildFillInstructions, executeFillInstructions, answerCustomQuestions } from '../agent/form-filler';
import { uploadResume } from '../agent/resume-uploader';
import { generateCoverLetter } from '../agent/cover-letter';
import { submitApplication } from '../agent/submitter';
import { detectPageType } from '../agent/navigator';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('generic');

const GENERIC_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function applyGenericJob(
  page: Page,
  job: { id: string; title: string; company: string; description: string; applyUrl: string },
  identity: Identity,
  logStep: LogStepFn,
  anthropicApiKey: string,
  resumePath: string,
  twoCaptchaApiKey?: string,
): Promise<ApplyResult> {
  const startTime = Date.now();
  logger.info('Starting generic application', { jobId: job.id, url: job.applyUrl });

  // Navigate
  await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await logStep('NAVIGATE', 'SUCCESS', `Loaded ${job.applyUrl}`);

  // Check page type
  const pageType = await detectPageType(page);

  // CAPTCHA check
  if (pageType.hasCaptcha) {
    if (!twoCaptchaApiKey) {
      throw new CaptchaDetectedError(job.applyUrl);
    }

    // Attempt to solve with 2Captcha
    const startCaptcha = Date.now();
    const solved = await attemptCaptchaSolve(page, twoCaptchaApiKey);
    if (!solved) {
      throw new CaptchaDetectedError(job.applyUrl);
    }
    await logStep('FILL_FORM', 'SUCCESS', 'CAPTCHA solved', Date.now() - startCaptcha);
  }

  // Login wall check
  if (pageType.hasLogin && !pageType.hasForm) {
    throw new LoginRequiredError(job.applyUrl);
  }

  // Detect form fields
  const startDetect = Date.now();
  const fields = await detectFormFields(page, anthropicApiKey);
  await logStep('FILL_FORM', 'SUCCESS', `Detected ${fields.length} fields`, Date.now() - startDetect);

  // Fill basic fields
  const startFill = Date.now();
  const instructions = buildFillInstructions(fields, identity);
  await executeFillInstructions(page, instructions);
  await logStep('FILL_FORM', 'SUCCESS', `Filled ${instructions.length} fields`, Date.now() - startFill);

  // Resume upload
  const startResume = Date.now();
  await uploadResume(page, fields, identity, resumePath);
  await logStep('UPLOAD_RESUME', 'SUCCESS', 'Resume handled', Date.now() - startResume);

  // Cover letter
  const coverLetterField = fields.find((f) => f.semanticMeaning === 'coverLetter');
  if (coverLetterField) {
    const startCover = Date.now();
    const coverLetter = await generateCoverLetter(job, identity, anthropicApiKey);
    const selector = coverLetterField.id
      ? `#${coverLetterField.id}`
      : `[name="${coverLetterField.name}"]`;
    const el = await page.$(selector);
    if (el) {
      await el.fill(coverLetter);
    }
    await logStep('GENERATE_COVER_LETTER', 'SUCCESS', 'Cover letter generated', Date.now() - startCover);
  }

  // Custom questions
  await answerCustomQuestions(page, fields, identity, job.description, anthropicApiKey);

  // Timeout check
  if (Date.now() - startTime > GENERIC_TIMEOUT_MS) {
    logger.warn('Generic apply timeout reached');
    return { success: false, error: 'Timeout after 10 minutes' };
  }

  // Submit
  const startSubmit = Date.now();
  const result = await submitApplication(page, job.applyUrl);
  await logStep('SUBMIT', result.success ? 'SUCCESS' : 'FAILURE', result.confirmationText || '', Date.now() - startSubmit);

  return result;
}

async function attemptCaptchaSolve(page: Page, apiKey: string): Promise<boolean> {
  try {
    // Find reCAPTCHA sitekey
    const sitekey = await page.evaluate(() => {
      const el = document.querySelector('.g-recaptcha, [data-sitekey]');
      return el?.getAttribute('data-sitekey') || null;
    });

    if (!sitekey) {
      logger.warn('CAPTCHA detected but no sitekey found');
      return false;
    }

    // Request solve from 2Captcha
    const requestUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(page.url())}&json=1`;
    const requestRes = await fetch(requestUrl);
    const requestData = (await requestRes.json()) as { status: number; request: string };

    if (requestData.status !== 1) {
      logger.warn('2Captcha request failed', { response: requestData });
      return false;
    }

    const captchaId = requestData.request;

    // Poll for result (max 120 seconds)
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const resultUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`;
      const resultRes = await fetch(resultUrl);
      const resultData = (await resultRes.json()) as { status: number; request: string };

      if (resultData.status === 1) {
        // Inject solution
        await page.evaluate((token) => {
          const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = token;
            textarea.style.display = 'block';
          }
          // Trigger callback if exists
          const callback = (window as Record<string, unknown>).__recaptchaCallback;
          if (typeof callback === 'function') {
            (callback as (token: string) => void)(token);
          }
        }, resultData.request);

        logger.info('CAPTCHA solved successfully');
        return true;
      }
    }

    logger.warn('CAPTCHA solve timeout');
    return false;
  } catch (err) {
    logger.error('CAPTCHA solve error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
