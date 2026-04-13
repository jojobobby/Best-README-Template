import { JobCreateInput } from '@applybot/shared';
import { createScraperLogger } from '../logger';

const logger = createScraperLogger('relevance');

export function filterRelevant(
  jobs: JobCreateInput[],
  searchKeywords: string[],
  excludeKeywords: string[],
): JobCreateInput[] {
  const filtered = jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();

    // Must match at least one search keyword in title
    const matchesKeyword = searchKeywords.some((kw) =>
      titleLower.includes(kw.toLowerCase()),
    );

    if (!matchesKeyword) return false;

    // Must NOT match any exclude keyword
    if (excludeKeywords.length > 0) {
      const matchesExclude = excludeKeywords.some((kw) =>
        titleLower.includes(kw.toLowerCase()),
      );
      if (matchesExclude) return false;
    }

    return true;
  });

  logger.info('Relevance filtering', {
    input: jobs.length,
    output: filtered.length,
    filtered: jobs.length - filtered.length,
  });

  return filtered;
}
