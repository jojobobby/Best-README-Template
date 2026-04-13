import { chromium, Browser, BrowserContext } from 'playwright';
import { BrowserError } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('browser');

const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'facebook.net',
  'analytics.',
  'tracking.',
];

let browserPool: Browser[] = [];
let maxPoolSize = 2;

export function setPoolSize(size: number) {
  maxPoolSize = size;
}

export async function acquireBrowser(
  headless: boolean,
  chromiumArgs: string,
): Promise<Browser> {
  // Reuse existing browser if available
  for (const browser of browserPool) {
    if (browser.isConnected()) {
      return browser;
    }
  }

  // Clean disconnected browsers
  browserPool = browserPool.filter((b) => b.isConnected());

  if (browserPool.length >= maxPoolSize) {
    logger.warn('Browser pool full, waiting for available browser');
    const connected = browserPool.find((b) => b.isConnected());
    if (connected) return connected;
  }

  try {
    const args = chromiumArgs.split(' ').filter(Boolean);
    const browser = await chromium.launch({
      headless,
      args,
    });

    browserPool.push(browser);

    browser.on('disconnected', () => {
      browserPool = browserPool.filter((b) => b !== browser);
      logger.info('Browser disconnected, removed from pool');
    });

    logger.info('Browser launched', { headless, poolSize: browserPool.length });
    return browser;
  } catch (err) {
    throw new BrowserError(
      `Failed to launch browser: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Block ads and trackers
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (AD_DOMAINS.some((domain) => url.includes(domain))) {
      route.abort();
      return;
    }
    route.continue();
  });

  return context;
}

export async function closeAllBrowsers(): Promise<void> {
  for (const browser of browserPool) {
    try {
      if (browser.isConnected()) {
        await browser.close();
      }
    } catch {
      // Ignore close errors
    }
  }
  browserPool = [];
  logger.info('All browsers closed');
}
