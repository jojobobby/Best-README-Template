import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@applybot/db';
import { Identity } from '@applybot/shared';
import { createWorkerLogger } from '../logger';

const logger = createWorkerLogger('cover-letter');

const MAX_WORDS = 600;

export async function generateCoverLetter(
  job: { id: string; title: string; company: string; description: string },
  identity: Identity,
  anthropicApiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const recentExperience = identity.workExperience[0];
  const experienceFormatted = recentExperience
    ? `${recentExperience.title} at ${recentExperience.company} (${recentExperience.startDate} - ${recentExperience.endDate}). ${recentExperience.description}`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system:
      'You are a professional cover letter writer. Write a compelling, personalized cover letter. Be specific to the job. Sound human, not robotic. 3-4 paragraphs. No generic filler phrases like "I am writing to express my interest". First paragraph: hook that shows you know the company. Second: your most relevant experience matched to job requirements. Third: specific achievement with a number if possible. Fourth: enthusiastic close with call to action. Use the applicant\'s actual details.',
    messages: [
      {
        role: 'user',
        content: `Job Title: ${job.title}
Company: ${job.company}
Job Description: ${job.description.slice(0, 2000)}

Applicant:
Name: ${identity.fullName}
Current Title: ${identity.currentTitle}
Summary: ${identity.summary}
Top Skills: ${identity.technicalSkills.slice(0, 8).join(', ')}
Recent Experience: ${experienceFormatted}

Write the cover letter now.`,
      },
    ],
  });

  let coverLetter =
    response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

  // Trim to max words
  const words = coverLetter.split(/\s+/);
  if (words.length > MAX_WORDS) {
    coverLetter = words.slice(0, MAX_WORDS).join(' ') + '...';
  }

  // Save to database
  await prisma.job.update({
    where: { id: job.id },
    data: { coverLetterGenerated: coverLetter },
  });

  logger.info('Cover letter generated', {
    jobId: job.id,
    wordCount: coverLetter.split(/\s+/).length,
  });

  return coverLetter;
}
