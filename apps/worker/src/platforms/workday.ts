import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { Identity, LogStepFn, ApplyResult, LoginRequiredError } from '@applybot/shared';
import { submitApplication } from '../agent/submitter';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('workday');

interface VisionField {
  label: string;
  inputType: string;
  currentValue: string;
}

export async function applyWorkdayJob(
  page: Page,
  job: { id: string; title: string; company: string; description: string; applyUrl: string },
  identity: Identity,
  logStep: LogStepFn,
  anthropicApiKey: string,
  resumePath: string,
  workdayEmail?: string,
  workdayPassword?: string,
): Promise<ApplyResult> {
  logger.info('Starting Workday application', { jobId: job.id, url: job.applyUrl });

  // Workday pages are slow — use longer timeout
  await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await logStep('NAVIGATE', 'SUCCESS', `Loaded ${job.applyUrl}`);

  // Check if login is required
  const hasLoginForm = await page.$('input[type="password"], [data-automation-id="signInPasswordInput"]');
  if (hasLoginForm) {
    if (!workdayEmail || !workdayPassword) {
      throw new LoginRequiredError(job.applyUrl);
    }

    // Attempt sign in
    const startLogin = Date.now();
    const emailInput = await page.$('[data-automation-id="signInEmailInput"], input[type="email"]');
    const passInput = await page.$('[data-automation-id="signInPasswordInput"], input[type="password"]');

    if (emailInput && passInput) {
      await emailInput.fill(workdayEmail);
      await passInput.fill(workdayPassword);

      const signInBtn = await page.$('button:has-text("Sign In"), [data-automation-id="signInButton"]');
      if (signInBtn) {
        await signInBtn.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }
    }
    await logStep('LOGIN', 'SUCCESS', 'Workday login completed', Date.now() - startLogin);
  }

  // Workday forms are heavily JS-rendered — use Claude vision to detect fields
  const client = new Anthropic({ apiKey: anthropicApiKey });

  let maxSteps = 8;
  while (maxSteps > 0) {
    const startStep = Date.now();

    // Take screenshot for Claude vision
    const screenshotBuffer = await page.screenshot({ type: 'png' });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    const visionResponse = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
            },
            {
              type: 'text',
              text: 'This is a Workday job application page. Identify all visible form fields and their labels. Return a JSON array of {label, inputType, currentValue}. Include buttons like "Next", "Submit", "Upload". Return ONLY valid JSON.',
            },
          ],
        },
      ],
    });

    const visionText =
      visionResponse.content[0]?.type === 'text' ? visionResponse.content[0].text : '[]';
    let jsonStr = visionText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let detectedFields: VisionField[];
    try {
      detectedFields = JSON.parse(jsonStr) as VisionField[];
    } catch {
      logger.warn('Failed to parse Workday vision response');
      break;
    }

    // Fill visible fields using getByLabel (more stable for Workday)
    for (const field of detectedFields) {
      try {
        const value = getWorkdayFieldValue(field.label, identity);
        if (!value) continue;

        const locator = page.getByLabel(field.label, { exact: false });
        const count = await locator.count();
        if (count === 0) continue;

        if (field.inputType === 'select' || field.inputType === 'dropdown') {
          await locator.first().click();
          await page.waitForTimeout(500);
          const option = page.getByRole('option', { name: value });
          if ((await option.count()) > 0) {
            await option.first().click();
          }
        } else if (field.inputType === 'file') {
          await page.setInputFiles('input[type="file"]', identity.resumePath || resumePath);
        } else {
          await locator.first().fill(value);
        }

        logger.info('Workday field filled', { label: field.label });
      } catch (err) {
        logger.warn('Failed to fill Workday field', {
          label: field.label,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await logStep('FILL_FORM', 'SUCCESS', `Filled Workday step`, Date.now() - startStep);

    // Check for Next button
    const nextButton = await page.$('button:has-text("Next"), button:has-text("Continue"), [data-automation-id="nextButton"]');
    const submitButton = await page.$('button:has-text("Submit"), [data-automation-id="submitButton"]');

    if (submitButton && (await submitButton.isVisible())) {
      // We're at the final step
      const startSubmit = Date.now();
      const result = await submitApplication(page, job.applyUrl);
      await logStep('SUBMIT', result.success ? 'SUCCESS' : 'FAILURE', result.confirmationText || '', Date.now() - startSubmit);
      return result;
    }

    if (nextButton && (await nextButton.isVisible())) {
      await nextButton.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      break;
    }

    maxSteps--;
  }

  // Final attempt to submit
  const startSubmit = Date.now();
  const result = await submitApplication(page, job.applyUrl);
  await logStep('SUBMIT', result.success ? 'SUCCESS' : 'FAILURE', result.confirmationText || '', Date.now() - startSubmit);

  return result;
}

function getWorkdayFieldValue(label: string, identity: Identity): string | null {
  const l = label.toLowerCase();
  if (l.includes('first name')) return identity.firstName;
  if (l.includes('last name')) return identity.lastName;
  if (l.includes('email')) return identity.email;
  if (l.includes('phone')) return identity.phoneFormatted;
  if (l.includes('address') && !l.includes('email')) return identity.address.street;
  if (l.includes('city')) return identity.address.city;
  if (l.includes('state') || l.includes('province')) return identity.address.state;
  if (l.includes('zip') || l.includes('postal')) return identity.address.zip;
  if (l.includes('country')) return identity.address.country;
  if (l.includes('linkedin')) return identity.linkedinUrl;
  if (l.includes('how did you hear') || l.includes('referral') || l.includes('source')) return 'Job Board';
  return null;
}
