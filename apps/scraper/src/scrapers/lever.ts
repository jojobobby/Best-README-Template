import { JobCreateInput } from '@applybot/shared';
import { createScraperLogger } from '../logger';

const logger = createScraperLogger('lever');

interface LeverPosting {
  id: string;
  text: string;
  categories: {
    team?: string;
    location?: string;
    commitment?: string;
  };
  hostedUrl: string;
  applyUrl: string;
  descriptionPlain: string;
  createdAt: number;
}

export async function scrapeLever(companySlugs: string[]): Promise<JobCreateInput[]> {
  const jobs: JobCreateInput[] = [];

  for (const slug of companySlugs) {
    try {
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      const response = await fetch(url);

      if (!response.ok) {
        logger.error('Lever API error', { slug, status: response.status });
        continue;
      }

      const data = (await response.json()) as LeverPosting[];

      if (!data || data.length === 0) {
        logger.info('No postings found for Lever company', { slug });
        continue;
      }

      for (const item of data) {
        jobs.push({
          sourceId: `lever-${slug}-${item.id}`,
          source: 'LEVER',
          title: item.text,
          company: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
          location: item.categories?.location,
          description: item.descriptionPlain || '',
          applyUrl: item.applyUrl || item.hostedUrl,
          requiresLogin: false,
        });
      }

      logger.info('Lever company fetched', { slug, postings: data.length });
    } catch (err) {
      logger.error('Lever scrape error', {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Lever scrape complete', { totalJobs: jobs.length });
  return jobs;
}
