import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { FormField, FormDetectionError } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('form-detector');

const formFieldCache = new Map<string, FormField[]>();

const SYSTEM_PROMPT = `You are a job application form analyzer. Given HTML of a job application page, identify all form fields and return a JSON array of fields with:
- id: the element's id attribute (or name if no id)
- name: the element's name attribute
- label: the visible label text for this field
- type: one of "text", "email", "phone", "textarea", "select", "radio", "checkbox", "file"
- required: boolean indicating if the field is required
- options: array of option values (for select/radio fields only)
- semanticMeaning: what personal info this field expects. Must be one of: firstName, lastName, fullName, email, phone, address, city, state, zip, country, linkedinUrl, githubUrl, portfolioUrl, currentTitle, currentCompany, resumeUpload, coverLetter, coverLetterUpload, yearsExperience, currentSalary, desiredSalary, workAuthorization, requiresSponsorship, veteranStatus, gender, ethnicity, disabilityStatus, startDate, noticePeriod, referral, website, customQuestion

Return ONLY a valid JSON array, no explanation or markdown.`;

export async function detectFormFields(
  page: Page,
  anthropicApiKey: string,
): Promise<FormField[]> {
  const url = page.url();

  // Generate cache key using URL + visible form content hash to avoid stale results on multi-step forms
  const contentHash = await page.evaluate(() => {
    const form = document.querySelector('form, [role="form"], .application-form, #application');
    const text = form ? form.textContent?.slice(0, 500) : document.body.textContent?.slice(0, 500);
    let hash = 0;
    for (let i = 0; i < (text?.length || 0); i++) {
      hash = ((hash << 5) - hash + (text?.charCodeAt(i) || 0)) | 0;
    }
    return hash.toString(36);
  });
  const cacheKey = `${url}#${contentHash}`;

  // Check cache
  const cached = formFieldCache.get(cacheKey);
  if (cached) {
    logger.info('Using cached form detection', { url, fieldCount: cached.length });
    return cached;
  }

  // Extract simplified HTML
  const simplifiedHtml = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;

    // Remove scripts, styles, and non-form elements
    clone.querySelectorAll('script, style, noscript, svg, img, video, audio, iframe:not([src*="captcha"]), header, footer, nav').forEach((el) => el.remove());

    // Keep only form-related structure
    const html = clone.innerHTML;

    // Limit size to ~15k chars for Claude context
    if (html.length > 15000) {
      const forms = clone.querySelectorAll('form, [role="form"], .application-form, #application');
      if (forms.length > 0) {
        return Array.from(forms)
          .map((f) => f.outerHTML)
          .join('\n')
          .slice(0, 15000);
      }
      return html.slice(0, 15000);
    }

    return html;
  });

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this job application page HTML and return the form fields as JSON:\n\n${simplifiedHtml}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON, handling potential markdown wrapping
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const fields = JSON.parse(jsonStr) as FormField[];

    if (!Array.isArray(fields)) {
      throw new FormDetectionError(url, 'Claude returned non-array response');
    }

    // Cache result (limit cache size to prevent memory leaks)
    if (formFieldCache.size > 50) {
      const firstKey = formFieldCache.keys().next().value;
      if (firstKey) formFieldCache.delete(firstKey);
    }
    formFieldCache.set(cacheKey, fields);

    logger.info('Form fields detected', { url, fieldCount: fields.length });
    return fields;
  } catch (err) {
    if (err instanceof FormDetectionError) throw err;
    throw new FormDetectionError(
      url,
      `Form detection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function clearFormCache() {
  formFieldCache.clear();
}
