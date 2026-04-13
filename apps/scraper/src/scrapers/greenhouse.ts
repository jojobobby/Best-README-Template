import { JobCreateInput } from '@applybot/shared';
import { createScraperLogger } from '../logger';

const logger = createScraperLogger('greenhouse');

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  content: string;
  updated_at: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function scrapeGreenhouse(companySlugs: string[]): Promise<JobCreateInput[]> {
  const jobs: JobCreateInput[] = [];

  for (const slug of companySlugs) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
      const response = await fetch(url);

      if (!response.ok) {
        logger.error('Greenhouse API error', { slug, status: response.status });
        continue;
      }

      const data = (await response.json()) as GreenhouseResponse;

      if (!data.jobs || data.jobs.length === 0) {
        logger.info('No jobs found for Greenhouse board', { slug });
        continue;
      }

      for (const item of data.jobs) {
        // Strip HTML from content
        const description = item.content
          ? item.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';

        jobs.push({
          sourceId: `gh-${slug}-${item.id}`,
          source: 'GREENHOUSE',
          title: item.title,
          company: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
          location: item.location?.name,
          description,
          applyUrl: item.absolute_url,
          requiresLogin: false,
        });
      }

      logger.info('Greenhouse board fetched', { slug, jobs: data.jobs.length });
    } catch (err) {
      logger.error('Greenhouse scrape error', {
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Greenhouse scrape complete', { totalJobs: jobs.length });
  return jobs;
}
