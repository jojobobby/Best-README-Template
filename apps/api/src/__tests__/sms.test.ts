import { parseSmsReply } from '@applybot/shared';

describe('SMS reply parsing', () => {
  test('Y is parsed as APPROVE', () => {
    expect(parseSmsReply('Y')).toBe('APPROVE');
  });

  test('y (lowercase) is parsed as APPROVE', () => {
    expect(parseSmsReply('y')).toBe('APPROVE');
  });

  test('YES is parsed as APPROVE', () => {
    expect(parseSmsReply('YES')).toBe('APPROVE');
  });

  test('yes with whitespace is parsed as APPROVE', () => {
    expect(parseSmsReply('  yes  ')).toBe('APPROVE');
  });

  test('APPLY is parsed as APPROVE', () => {
    expect(parseSmsReply('APPLY')).toBe('APPROVE');
  });

  test('N is parsed as REJECT', () => {
    expect(parseSmsReply('N')).toBe('REJECT');
  });

  test('n (lowercase) is parsed as REJECT', () => {
    expect(parseSmsReply('n')).toBe('REJECT');
  });

  test('NO is parsed as REJECT', () => {
    expect(parseSmsReply('NO')).toBe('REJECT');
  });

  test('SKIP is parsed as REJECT', () => {
    expect(parseSmsReply('SKIP')).toBe('REJECT');
  });

  test('ambiguous text is parsed as AMBIGUOUS', () => {
    expect(parseSmsReply('Maybe later')).toBe('AMBIGUOUS');
  });

  test('empty string is AMBIGUOUS', () => {
    expect(parseSmsReply('')).toBe('AMBIGUOUS');
  });

  test('random text is AMBIGUOUS', () => {
    expect(parseSmsReply('I need to think about it')).toBe('AMBIGUOUS');
  });
});

describe('Status transitions', () => {
  const { validateStatusTransition, JobStatusError } = require('@applybot/shared');

  test('PENDING_REVIEW can transition to APPROVED', () => {
    expect(() => validateStatusTransition('PENDING_REVIEW', 'APPROVED', 'test')).not.toThrow();
  });

  test('PENDING_REVIEW can transition to REJECTED', () => {
    expect(() => validateStatusTransition('PENDING_REVIEW', 'REJECTED', 'test')).not.toThrow();
  });

  test('PENDING_REVIEW cannot transition to APPLIED', () => {
    expect(() => validateStatusTransition('PENDING_REVIEW', 'APPLIED', 'test')).toThrow(JobStatusError);
  });

  test('APPROVED can transition to APPLYING', () => {
    expect(() => validateStatusTransition('APPROVED', 'APPLYING', 'test')).not.toThrow();
  });

  test('APPLYING can transition to APPLIED', () => {
    expect(() => validateStatusTransition('APPLYING', 'APPLIED', 'test')).not.toThrow();
  });

  test('APPLYING can transition to FAILED', () => {
    expect(() => validateStatusTransition('APPLYING', 'FAILED', 'test')).not.toThrow();
  });

  test('APPLIED cannot transition to anything', () => {
    expect(() => validateStatusTransition('APPLIED', 'PENDING_REVIEW', 'test')).toThrow(JobStatusError);
  });

  test('FAILED can transition to APPROVED (retry)', () => {
    expect(() => validateStatusTransition('FAILED', 'APPROVED', 'test')).not.toThrow();
  });
});
