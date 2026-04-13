import { Page } from 'playwright';
import { Identity, LogStepFn, ApplyResult } from '@applybot/shared';
import { detectFormFields } from '../agent/form-detector';
import { buildFillInstructions, executeFillInstructions, answerCustomQuestions } from '../agent/form-filler';
import { uploadResume } from '../agent/resume-uploader';
import { generateCoverLetter } from '../agent/cover-letter';
import { submitApplication } from '../agent/submitter';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('greenhouse');

export async function applyGreenhouseJob(
  page: Page,
  job: { id: string; title: string; company: string; description: string; applyUrl: string },
  identity: Identity,
  logStep: LogStepFn,
  anthropicApiKey: string,
  resumePath: string,
): Promise<ApplyResult> {
  logger.info('Starting Greenhouse application', { jobId: job.id, url: job.applyUrl });

  // Navigate to apply page — Greenhouse URLs go directly to the apply form
  let applyUrl = job.applyUrl;
  if (!applyUrl.includes('#app')) {
    applyUrl = applyUrl.replace(/\/?$/, '#app');
  }

  await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await logStep('NAVIGATE', 'SUCCESS', `Loaded ${applyUrl}`);

  // Detect current step by looking at heading
  const getStepHeading = async () => {
    return page.evaluate(() => {
      const h = document.querySelector('h2, h3, .section-header, [data-test="section-title"]');
      return h?.textContent?.trim() || '';
    });
  };

  // Check if there's a multi-step form
  const hasSteps = await page.$('.application-form, #application, form[action*="greenhouse"]');

  if (!hasSteps) {
    // May need to click "Apply" button first
    const applyButton = await page.$('a:has-text("Apply"), button:has-text("Apply for this job"), a.btn:has-text("Apply")');
    if (applyButton) {
      await applyButton.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }
  }

  // Detect form fields
  const startDetect = Date.now();
  const fields = await detectFormFields(page, anthropicApiKey);
  await logStep('FILL_FORM', 'SUCCESS', `Detected ${fields.length} fields`, Date.now() - startDetect);

  // Fill basic info fields
  const startFill = Date.now();
  const instructions = buildFillInstructions(fields, identity);
  await executeFillInstructions(page, instructions);
  await logStep('FILL_FORM', 'SUCCESS', `Filled ${instructions.length} fields`, Date.now() - startFill);

  // Upload resume
  const startResume = Date.now();
  await uploadResume(page, fields, identity, resumePath);
  await logStep('UPLOAD_RESUME', 'SUCCESS', 'Resume uploaded', Date.now() - startResume);

  // Generate and fill cover letter if field exists
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
    await logStep('GENERATE_COVER_LETTER', 'SUCCESS', 'Cover letter generated and filled', Date.now() - startCover);
  }

  // Answer custom questions
  await answerCustomQuestions(page, fields, identity, job.description, anthropicApiKey);

  // Check for Next button (multi-step) and continue clicking through
  let maxSteps = 5;
  while (maxSteps > 0) {
    const nextButton = await page.$('button:has-text("Next"), input[value="Next"], button:has-text("Continue")');
    if (!nextButton || !(await nextButton.isVisible())) break;

    await nextButton.click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const heading = await getStepHeading();
    logger.info('Navigated to next step', { heading });

    // Detect and fill new fields on this step
    const stepFields = await detectFormFields(page, anthropicApiKey);
    const stepInstructions = buildFillInstructions(stepFields, identity);
    await executeFillInstructions(page, stepInstructions);
    await answerCustomQuestions(page, stepFields, identity, job.description, anthropicApiKey);

    maxSteps--;
  }

  // Submit
  const startSubmit = Date.now();
  const result = await submitApplication(page, job.applyUrl);
  await logStep('SUBMIT', result.success ? 'SUCCESS' : 'FAILURE', result.confirmationText || '', Date.now() - startSubmit);

  return result;
}
