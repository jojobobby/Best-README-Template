import { JobCreateInput } from '@applybot/shared';
import { createScraperLogger } from '../logger';

const logger = createScraperLogger('adzuna');

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  description: string;
  redirect_url: string;
  created: string;
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

export async function scrapeAdzuna(
  appId: string,
  appKey: string,
  keywords: string[],
  location: string,
): Promise<JobCreateInput[]> {
  const jobs: JobCreateInput[] = [];
  const query = keywords.join(' OR ');
  const maxPages = 3;
  const resultsPerPage = 50;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: String(resultsPerPage),
        what: query,
        where: location,
        sort_by: 'date',
        page: String(page),
      });

      const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        logger.error('Adzuna API error', {
          status: response.status,
          page,
        });
        break;
      }

      const data = (await response.json()) as AdzunaResponse;

      if (!data.results || data.results.length === 0) {
        logger.info('No more results from Adzuna', { page });
        break;
      }

      for (const item of data.results) {
        jobs.push({
          sourceId: String(item.id),
          source: 'ADZUNA',
          title: item.title,
          company: item.company?.display_name || 'Unknown',
          location: item.location?.display_name,
          salaryMin: item.salary_min ? Math.round(item.salary_min) : undefined,
          salaryMax: item.salary_max ? Math.round(item.salary_max) : undefined,
          salaryCurrency: 'USD',
          description: item.description || '',
          applyUrl: item.redirect_url,
          requiresLogin: false,
        });
      }

      logger.info('Adzuna page fetched', {
        page,
        results: data.results.length,
        total: data.count,
      });
    } catch (err) {
      logger.error('Adzuna scrape error', {
        page,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  logger.info('Adzuna scrape complete', { totalJobs: jobs.length });
  return jobs;
}
