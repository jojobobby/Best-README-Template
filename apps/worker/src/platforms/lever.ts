import { Page } from 'playwright';
import { Identity, LogStepFn, ApplyResult } from '@applybot/shared';
import { detectFormFields } from '../agent/form-detector';
import { buildFillInstructions, executeFillInstructions, answerCustomQuestions } from '../agent/form-filler';
import { uploadResume } from '../agent/resume-uploader';
import { generateCoverLetter } from '../agent/cover-letter';
import { submitApplication } from '../agent/submitter';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('lever');

export async function applyLeverJob(
  page: Page,
  job: { id: string; title: string; company: string; description: string; applyUrl: string },
  identity: Identity,
  logStep: LogStepFn,
  anthropicApiKey: string,
  resumePath: string,
): Promise<ApplyResult> {
  logger.info('Starting Lever application', { jobId: job.id, url: job.applyUrl });

  // Navigate to the apply URL
  await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  // If we're on the posting page, click Apply
  const applyButton = await page.$('a.postings-btn:has-text("Apply"), a:has-text("Apply for this job"), .apply-button');
  if (applyButton) {
    await applyButton.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  await logStep('NAVIGATE', 'SUCCESS', `Loaded ${job.applyUrl}`);

  // Lever forms are single-page
  const startDetect = Date.now();
  const fields = await detectFormFields(page, anthropicApiKey);
  await logStep('FILL_FORM', 'SUCCESS', `Detected ${fields.length} fields`, Date.now() - startDetect);

  // Fill fields
  const startFill = Date.now();
  const instructions = buildFillInstructions(fields, identity);
  await executeFillInstructions(page, instructions);
  await logStep('FILL_FORM', 'SUCCESS', `Filled ${instructions.length} fields`, Date.now() - startFill);

  // Upload resume — Lever uses a hidden file input in a dropzone
  const startResume = Date.now();
  await uploadResume(page, fields, identity, resumePath);
  await logStep('UPLOAD_RESUME', 'SUCCESS', 'Resume uploaded', Date.now() - startResume);

  // Cover letter if field exists
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

  // Submit — Lever's button says "Submit application"
  const startSubmit = Date.now();
  const result = await submitApplication(page, job.applyUrl);
  await logStep('SUBMIT', result.success ? 'SUCCESS' : 'FAILURE', result.confirmationText || '', Date.now() - startSubmit);

  return result;
}
