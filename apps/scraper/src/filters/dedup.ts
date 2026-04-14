import { prisma, JobSource } from '@applybot/db';
import { createScraperLogger } from '../logger';

const logger = createScraperLogger('dedup');

export async function checkDuplicate(sourceId: string, source: string): Promise<boolean> {
  const existing = await prisma.job.findFirst({
    where: { sourceId, source: source as JobSource },
    select: { id: true },
  });
  return existing !== null;
}

export async function filterNewJobs<T extends { sourceId: string; source: string }>(
  jobs: T[],
): Promise<{ newJobs: T[]; duplicateCount: number }> {
  const newJobs: T[] = [];
  let duplicateCount = 0;

  for (const job of jobs) {
    const isDuplicate = await checkDuplicate(job.sourceId, job.source);
    if (isDuplicate) {
      duplicateCount++;
    } else {
      newJobs.push(job);
    }
  }

  logger.info('Dedup complete', {
    total: jobs.length,
    new: newJobs.length,
    duplicate: duplicateCount,
  });

  return { newJobs, duplicateCount };
}
