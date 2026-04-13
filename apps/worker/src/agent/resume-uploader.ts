import * as fs from 'fs';
import { Page } from 'playwright';
import { FormField, Identity, BrowserError } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('resume-uploader');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadResume(
  page: Page,
  fields: FormField[],
  identity: Identity,
  resumePath: string,
): Promise<void> {
  const fileField = fields.find((f) => f.semanticMeaning === 'resumeUpload');

  if (fileField) {
    // File upload path
    const filePath = identity.resumePath || resumePath;

    if (!fs.existsSync(filePath)) {
      throw new BrowserError(`Resume file not found at ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new BrowserError(`Resume file too large (${stats.size} bytes > ${MAX_FILE_SIZE} limit)`);
    }

    const selector = fileField.id ? `#${fileField.id}` : `[name="${fileField.name}"]`;

    try {
      await page.setInputFiles(selector, filePath);

      // Wait for upload progress if any
      const uploadIndicator = await page
        .$('.upload-progress, .uploading, [class*="progress"], [class*="upload"]')
        .catch(() => null);

      if (uploadIndicator) {
        logger.info('Waiting for upload to complete...');
        await page
          .waitForFunction(
            (sel) => {
              const el = document.querySelector(sel);
              return !el || el.getAttribute('aria-valuenow') === '100' || !el.classList.contains('uploading');
            },
            selector,
            { timeout: 30000 },
          )
          .catch(() => {
            logger.warn('Upload progress timeout, proceeding');
          });
      }

      // Check for upload error messages
      const errorMsg = await page
        .$eval('.upload-error, .error-message, [class*="error"]', (el) => el.textContent)
        .catch(() => null);

      if (errorMsg && errorMsg.toLowerCase().includes('upload')) {
        throw new BrowserError(`Resume upload failed: ${errorMsg}`);
      }

      logger.info('Resume uploaded via file input', { filePath });
    } catch (err) {
      if (err instanceof BrowserError) throw err;
      throw new BrowserError(
        `Resume upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    // Fallback: look for resume text area
    const textArea = fields.find(
      (f) =>
        f.type === 'textarea' &&
        (f.label.toLowerCase().includes('resume') ||
          f.label.toLowerCase().includes('cv') ||
          f.label.toLowerCase().includes('paste')),
    );

    if (textArea && identity.resumeText) {
      const selector = textArea.id ? `#${textArea.id}` : `[name="${textArea.name}"]`;
      const element = await page.$(selector);
      if (element) {
        await element.fill(identity.resumeText);
        logger.info('Resume pasted as text');
      }
    } else {
      logger.warn('No resume upload field or text area found');
    }
  }
}
