import { Page, ElementHandle } from 'playwright';
import { SubmissionError } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('submitter');

const SUBMIT_BUTTON_SELECTORS = [
  'input[type="submit"]',
  'button[type="submit"]',
  'button:has-text("Submit")',
  'button:has-text("Apply")',
  'button:has-text("Send Application")',
  'button:has-text("Submit Application")',
  'button:has-text("Apply Now")',
  '[data-action="submit"]',
  '.submit-btn',
  '.apply-btn',
];

const SUCCESS_INDICATORS = [
  'thank you',
  'thanks for applying',
  'application received',
  'successfully applied',
  'successfully submitted',
  'confirmation',
  "we'll be in touch",
  'we will review',
  'application has been submitted',
  'you have applied',
];

const FAILURE_INDICATORS = ['required field', 'please fill', 'error', 'is required', 'invalid'];

export async function findSubmitButton(page: Page): Promise<ElementHandle | null> {
  for (const selector of SUBMIT_BUTTON_SELECTORS) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          logger.info('Submit button found', { selector });
          return button;
        }
      }
    } catch {
      // Continue trying other selectors
    }
  }

  logger.warn('No submit button found with known selectors');
  return null;
}

export interface SubmitResult {
  success: boolean;
  confirmationText?: string;
}

export async function submitApplication(
  page: Page,
  jobUrl: string,
): Promise<SubmitResult> {
  const submitButton = await findSubmitButton(page);
  if (!submitButton) {
    throw new SubmissionError(jobUrl, 'Could not find submit button');
  }

  const urlBefore = page.url();

  // Click submit
  await submitButton.click();
  logger.info('Submit button clicked');

  // Wait for response
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {
    // Timeout is OK — check page content below
  }

  // Check for success
  const pageText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');

  const urlChanged = page.url() !== urlBefore;
  const hasSuccessText = SUCCESS_INDICATORS.some((indicator) => pageText.includes(indicator));
  const hasUrlConfirmation = page.url().includes('confirmation') || page.url().includes('success') || page.url().includes('thank');

  if (hasSuccessText || hasUrlConfirmation || (urlChanged && !hasFailureText(pageText))) {
    const confirmationText = extractConfirmation(pageText);
    logger.info('Application submitted successfully', { confirmationText });
    return { success: true, confirmationText };
  }

  // Check for errors
  if (hasFailureText(pageText)) {
    const errors = extractErrors(pageText);
    throw new SubmissionError(jobUrl, `Form has errors: ${errors}`);
  }

  // Not sure — might have worked
  if (urlChanged) {
    logger.warn('URL changed but no clear success indicator');
    return { success: true, confirmationText: 'URL changed after submission (unconfirmed)' };
  }

  throw new SubmissionError(jobUrl, 'Could not confirm submission after 15 seconds');
}

function hasFailureText(text: string): boolean {
  return FAILURE_INDICATORS.some((indicator) => text.includes(indicator));
}

function extractConfirmation(text: string): string | undefined {
  for (const indicator of SUCCESS_INDICATORS) {
    const idx = text.indexOf(indicator);
    if (idx !== -1) {
      return text.slice(idx, idx + 200).split('\n')[0] || undefined;
    }
  }
  return undefined;
}

function extractErrors(text: string): string {
  const errors: string[] = [];
  for (const indicator of FAILURE_INDICATORS) {
    const idx = text.indexOf(indicator);
    if (idx !== -1) {
      const snippet = text.slice(Math.max(0, idx - 20), idx + 80).trim();
      errors.push(snippet);
    }
  }
  return errors.slice(0, 3).join('; ') || 'Unknown form errors';
}
