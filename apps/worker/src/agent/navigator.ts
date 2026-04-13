import { Page } from 'playwright';
import { BrowserError } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('navigator');

export async function navigateToUrl(
  page: Page,
  url: string,
  timeoutMs = 30000,
): Promise<void> {
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    if (!response) {
      throw new BrowserError(`No response received for ${url}`);
    }

    if (response.status() >= 400) {
      throw new BrowserError(`HTTP ${response.status()} loading ${url}`);
    }

    // Wait for any dynamic content to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      logger.warn('Network idle timeout, proceeding anyway', { url });
    });

    logger.info('Page loaded', { url, status: response.status() });
  } catch (err) {
    if (err instanceof BrowserError) throw err;
    throw new BrowserError(
      `Navigation failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function detectPageType(page: Page): Promise<{
  hasForm: boolean;
  hasLogin: boolean;
  hasCaptcha: boolean;
  platform: string | null;
}> {
  const result = await page.evaluate(() => {
    const html = document.documentElement.innerHTML.toLowerCase();

    const hasForm =
      document.querySelectorAll('form').length > 0 ||
      document.querySelectorAll('input[type="text"], input[type="email"]').length > 2;

    const hasLogin =
      html.includes('sign in') ||
      html.includes('log in') ||
      html.includes('login') ||
      (document.querySelectorAll('input[type="password"]').length > 0 &&
        !html.includes('apply'));

    const hasCaptcha =
      html.includes('recaptcha') ||
      html.includes('hcaptcha') ||
      html.includes('cf-turnstile') ||
      document.querySelectorAll('iframe[src*="captcha"]').length > 0;

    return { hasForm, hasLogin, hasCaptcha };
  });

  const url = page.url();
  let platform: string | null = null;
  if (url.includes('greenhouse.io')) platform = 'greenhouse';
  else if (url.includes('lever.co')) platform = 'lever';
  else if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) platform = 'workday';

  return { ...result, platform };
}
