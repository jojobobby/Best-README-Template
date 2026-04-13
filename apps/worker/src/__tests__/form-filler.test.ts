import { buildFillInstructions } from '../agent/form-filler';
import { FormField, Identity } from '@applybot/shared';

const mockIdentity: Identity = {
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  email: 'test@example.com',
  phone: '+15551234567',
  phoneFormatted: '(555) 123-4567',
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    country: 'United States',
  },
  linkedinUrl: 'https://linkedin.com/in/testuser',
  githubUrl: 'https://github.com/testuser',
  portfolioUrl: 'https://testuser.dev',
  currentTitle: 'Software Engineer',
  yearsOfExperience: 5,
  summary: 'Experienced software engineer.',
  workExperience: [
    {
      company: 'Acme Corp',
      title: 'Software Engineer',
      startDate: '01/2020',
      endDate: 'Present',
      location: 'SF',
      description: 'Building apps',
      achievements: [],
    },
  ],
  education: [
    {
      institution: 'University',
      degree: 'BS',
      field: 'CS',
      startDate: '09/2015',
      endDate: '06/2019',
    },
  ],
  technicalSkills: ['TypeScript'],
  softSkills: [],
  certifications: [],
  languages: ['TypeScript'],
  desiredSalaryMin: 120000,
  desiredSalaryMax: 180000,
  willingToRelocate: false,
  remotePreference: 'remote',
  preferredLocations: [],
  resumePath: '/identity/resume.pdf',
  resumeText: 'Test resume text',
  defaultCoverLetterTemplate: '',
  authorizedToWork: true,
  requiresSponsorship: false,
  veteranStatus: 'Not a veteran',
  disabilityStatus: 'Decline',
  gender: 'Decline',
  ethnicity: 'Decline',
  willingToBackgroundCheck: true,
  willingToDrugTest: true,
  noticePeriod: '2 weeks',
  availableStartDate: 'Immediately',
  encryptedAt: '2024-01-01T00:00:00Z',
  version: 1,
};

describe('Form filler', () => {
  test('maps firstName field to identity.firstName', () => {
    const fields: FormField[] = [
      { id: 'first_name', name: 'first_name', label: 'First Name', type: 'text', required: true, semanticMeaning: 'firstName' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions).toHaveLength(1);
    expect(instructions[0]!.value).toBe('Test');
    expect(instructions[0]!.selector).toBe('#first_name');
  });

  test('maps email field correctly', () => {
    const fields: FormField[] = [
      { id: 'email', name: 'email', label: 'Email', type: 'email', required: true, semanticMeaning: 'email' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions[0]!.value).toBe('test@example.com');
  });

  test('maps phone with formatted value', () => {
    const fields: FormField[] = [
      { id: 'phone', name: 'phone', label: 'Phone', type: 'phone', required: true, semanticMeaning: 'phone' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions[0]!.value).toBe('(555) 123-4567');
  });

  test('maps address fields', () => {
    const fields: FormField[] = [
      { id: 'city', name: 'city', label: 'City', type: 'text', required: true, semanticMeaning: 'city' },
      { id: 'state', name: 'state', label: 'State', type: 'text', required: true, semanticMeaning: 'state' },
      { id: 'zip', name: 'zip', label: 'ZIP', type: 'text', required: true, semanticMeaning: 'zip' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions).toHaveLength(3);
    expect(instructions.find((i) => i.selector === '#city')!.value).toBe('San Francisco');
    expect(instructions.find((i) => i.selector === '#state')!.value).toBe('CA');
    expect(instructions.find((i) => i.selector === '#zip')!.value).toBe('94102');
  });

  test('maps work authorization correctly', () => {
    const fields: FormField[] = [
      { id: 'auth', name: 'auth', label: 'Authorized to work?', type: 'select', required: true, semanticMeaning: 'workAuthorization', options: ['Yes', 'No'] },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions[0]!.value).toBe('Yes');
    expect(instructions[0]!.type).toBe('select');
  });

  test('skips resumeUpload fields (handled separately)', () => {
    const fields: FormField[] = [
      { id: 'resume', name: 'resume', label: 'Resume', type: 'file', required: true, semanticMeaning: 'resumeUpload' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions).toHaveLength(0);
  });

  test('skips coverLetter fields (handled separately)', () => {
    const fields: FormField[] = [
      { id: 'cover', name: 'cover', label: 'Cover Letter', type: 'textarea', required: false, semanticMeaning: 'coverLetter' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions).toHaveLength(0);
  });

  test('skips customQuestion fields (handled by Claude)', () => {
    const fields: FormField[] = [
      { id: 'q1', name: 'q1', label: 'Why do you want this job?', type: 'textarea', required: true, semanticMeaning: 'customQuestion' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions).toHaveLength(0);
  });

  test('uses name selector when id is empty', () => {
    const fields: FormField[] = [
      { id: '', name: 'last_name', label: 'Last Name', type: 'text', required: true, semanticMeaning: 'lastName' },
    ];
    const instructions = buildFillInstructions(fields, mockIdentity);
    expect(instructions[0]!.selector).toBe('[name="last_name"]');
  });
});
