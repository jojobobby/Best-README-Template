import { filterRelevant } from '../filters/relevance';
import { JobCreateInput } from '@applybot/shared';

const makeJob = (title: string): JobCreateInput => ({
  sourceId: `test-${Math.random()}`,
  source: 'ADZUNA',
  title,
  company: 'Test Co',
  description: 'Test description',
  applyUrl: 'https://example.com/apply',
});

describe('Relevance filtering', () => {
  const searchKeywords = ['software engineer', 'fullstack', 'backend', 'frontend'];
  const excludeKeywords = ['senior', 'staff', 'principal', 'director'];

  test('matches job with exact keyword in title', () => {
    const jobs = [makeJob('Software Engineer')];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(1);
  });

  test('matches job with partial keyword (case-insensitive)', () => {
    const jobs = [makeJob('Junior Backend Developer')];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(1);
  });

  test('excludes jobs with exclude keywords', () => {
    const jobs = [makeJob('Senior Software Engineer')];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(0);
  });

  test('excludes staff-level jobs', () => {
    const jobs = [makeJob('Staff Backend Engineer')];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(0);
  });

  test('filters out unrelated jobs', () => {
    const jobs = [makeJob('Product Manager'), makeJob('Data Analyst')];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(0);
  });

  test('handles mixed results correctly', () => {
    const jobs = [
      makeJob('Software Engineer'), // match
      makeJob('Senior Software Engineer'), // excluded
      makeJob('Product Manager'), // no keyword match
      makeJob('Fullstack Developer'), // match
      makeJob('Principal Engineer'), // excluded
    ];
    const result = filterRelevant(jobs, searchKeywords, excludeKeywords);
    expect(result).toHaveLength(2);
  });

  test('works with empty exclude list', () => {
    const jobs = [makeJob('Senior Software Engineer')];
    const result = filterRelevant(jobs, searchKeywords, []);
    expect(result).toHaveLength(1);
  });

  test('handles empty job list', () => {
    const result = filterRelevant([], searchKeywords, excludeKeywords);
    expect(result).toHaveLength(0);
  });
});
