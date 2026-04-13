import * as fs from 'fs';
import * as path from 'path';
import { Page } from 'playwright';
import { prisma } from '@applybot/db';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('screenshot');

export async function captureScreenshot(
  page: Page,
  jobId: string,
  screenshotDir: string,
): Promise<string | null> {
  try {
    // Ensure directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `${jobId}-${timestamp}.png`;
    const filepath = path.join(screenshotDir, filename);

    await page.screenshot({
      path: filepath,
      fullPage: true,
    });

    // Update job record
    await prisma.job.update({
      where: { id: jobId },
      data: { screenshotPath: filepath },
    });

    logger.info('Screenshot captured', { jobId, filepath });
    return filepath;
  } catch (err) {
    logger.warn('Failed to capture screenshot', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
