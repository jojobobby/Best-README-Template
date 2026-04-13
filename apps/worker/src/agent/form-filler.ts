import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { FormField, FillInstruction, Identity, SemanticFieldMeaning } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('form-filler');

function mapSemanticToValue(meaning: SemanticFieldMeaning, identity: Identity): string | null {
  const map: Record<string, string | null> = {
    firstName: identity.firstName,
    lastName: identity.lastName,
    fullName: identity.fullName,
    email: identity.email,
    phone: identity.phoneFormatted,
    address: identity.address.street,
    city: identity.address.city,
    state: identity.address.state,
    zip: identity.address.zip,
    country: identity.address.country,
    linkedinUrl: identity.linkedinUrl,
    githubUrl: identity.githubUrl,
    portfolioUrl: identity.portfolioUrl,
    currentTitle: identity.currentTitle,
    currentCompany: identity.workExperience[0]?.company || '',
    yearsExperience: String(identity.yearsOfExperience),
    currentSalary: String(identity.desiredSalaryMin),
    desiredSalary: String(identity.desiredSalaryMax),
    workAuthorization: identity.authorizedToWork ? 'Yes' : 'No',
    requiresSponsorship: identity.requiresSponsorship ? 'Yes' : 'No',
    veteranStatus: identity.veteranStatus,
    gender: identity.gender,
    ethnicity: identity.ethnicity,
    disabilityStatus: identity.disabilityStatus,
    startDate: identity.availableStartDate,
    noticePeriod: identity.noticePeriod,
    website: identity.portfolioUrl,
    referral: '',
  };

  return map[meaning] ?? null;
}

export function buildFillInstructions(
  fields: FormField[],
  identity: Identity,
): FillInstruction[] {
  const instructions: FillInstruction[] = [];

  for (const field of fields) {
    if (field.semanticMeaning === 'resumeUpload' || field.semanticMeaning === 'coverLetterUpload') {
      continue; // Handled separately
    }

    if (field.semanticMeaning === 'coverLetter') {
      continue; // Handled by cover letter generator
    }

    if (field.semanticMeaning === 'customQuestion') {
      continue; // Handled separately by Claude
    }

    const value = mapSemanticToValue(field.semanticMeaning, identity);
    if (value === null) continue;

    const selector = field.id ? `#${field.id}` : field.name ? `[name="${field.name}"]` : '';
    if (!selector) continue;

    let fillType: FillInstruction['type'] = 'type';
    if (field.type === 'select') fillType = 'select';
    else if (field.type === 'radio') fillType = 'radio';
    else if (field.type === 'checkbox') fillType = 'checkbox';

    instructions.push({
      selector,
      value,
      type: fillType,
      label: field.label,
    });
  }

  return instructions;
}

export async function executeFillInstructions(
  page: Page,
  instructions: FillInstruction[],
): Promise<void> {
  for (const instr of instructions) {
    try {
      const element = await page.$(instr.selector);
      if (!element) {
        logger.warn('Element not found', { selector: instr.selector, label: instr.label });
        continue;
      }

      // Scroll into view
      await element.scrollIntoViewIfNeeded();

      switch (instr.type) {
        case 'type': {
          await element.click();
          await element.fill('');
          // Type with human-like delay
          for (const char of instr.value) {
            await page.keyboard.type(char, { delay: 15 + Math.random() * 20 });
          }
          break;
        }
        case 'select': {
          // Try exact match first, then partial
          try {
            await page.selectOption(instr.selector, { label: instr.value });
          } catch {
            // Try partial match
            const options = await page.$$eval(`${instr.selector} option`, (opts) =>
              opts.map((o) => ({ value: o.getAttribute('value') || '', text: o.textContent || '' })),
            );
            const match = options.find(
              (o) =>
                o.text.toLowerCase().includes(instr.value.toLowerCase()) ||
                instr.value.toLowerCase().includes(o.text.toLowerCase()),
            );
            if (match) {
              await page.selectOption(instr.selector, match.value);
            } else {
              logger.warn('No matching select option', {
                selector: instr.selector,
                desired: instr.value,
              });
            }
          }
          break;
        }
        case 'radio': {
          const elName = await element.evaluate((el) => (el as HTMLInputElement).name);
          const radios = await page.$$(`input[name="${elName}"]`);
          for (const radio of radios) {
            const value = await radio.getAttribute('value');
            if (value && value.toLowerCase().includes(instr.value.toLowerCase())) {
              await radio.click();
              break;
            }
          }
          break;
        }
        case 'checkbox': {
          const isChecked = await element.isChecked();
          const shouldCheck = ['yes', 'true', '1'].includes(instr.value.toLowerCase());
          if (shouldCheck !== isChecked) {
            await element.click();
          }
          break;
        }
      }

      logger.info('Field filled', { label: instr.label, type: instr.type });
    } catch (err) {
      logger.warn('Failed to fill field', {
        selector: instr.selector,
        label: instr.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function answerCustomQuestions(
  page: Page,
  fields: FormField[],
  identity: Identity,
  jobDescription: string,
  anthropicApiKey: string,
): Promise<void> {
  const customFields = fields.filter((f) => f.semanticMeaning === 'customQuestion');

  if (customFields.length === 0) return;

  const client = new Anthropic({ apiKey: anthropicApiKey });

  for (const field of customFields) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 500,
        system:
          'You are filling out a job application. Answer the question concisely, professionally, and truthfully based on the applicant profile provided. Keep answers under 200 words. Do not use generic filler.',
        messages: [
          {
            role: 'user',
            content: `Question: "${field.label}"\n\nJob Description: ${jobDescription.slice(0, 500)}\n\nApplicant: ${identity.fullName}, ${identity.currentTitle} with ${identity.yearsOfExperience} years experience.\nSkills: ${identity.technicalSkills.slice(0, 8).join(', ')}\nSummary: ${identity.summary}\n\nAnswer this question:`,
          },
        ],
      });

      const answer =
        response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

      if (answer) {
        const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`;
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await element.fill(answer);
          logger.info('Custom question answered', { label: field.label });
        }
      }
    } catch (err) {
      logger.warn('Failed to answer custom question', {
        label: field.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
