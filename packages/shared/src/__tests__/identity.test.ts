import { encryptIdentity, decryptIdentity } from '../utils/identity';
import { Identity, identitySchema } from '../types/identity';
import { IdentityDecryptionError } from '../errors';

const sampleIdentity: Identity = {
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
  portfolioUrl: '',
  currentTitle: 'Software Engineer',
  yearsOfExperience: 5,
  summary: 'Experienced software engineer with expertise in full-stack development.',
  workExperience: [
    {
      company: 'Acme Corp',
      title: 'Software Engineer',
      startDate: '01/2020',
      endDate: 'Present',
      location: 'San Francisco, CA',
      description: 'Building web applications',
      achievements: ['Led migration to TypeScript', 'Reduced API latency by 40%'],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      startDate: '09/2015',
      endDate: '06/2019',
    },
  ],
  technicalSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  softSkills: ['Communication', 'Leadership'],
  certifications: [],
  languages: ['TypeScript', 'Python', 'Go'],
  desiredSalaryMin: 120000,
  desiredSalaryMax: 180000,
  willingToRelocate: false,
  remotePreference: 'remote',
  preferredLocations: ['San Francisco', 'Remote'],
  resumePath: '/identity/resume.pdf',
  resumeText: 'Test User - Software Engineer with 5 years of experience in full-stack development.',
  defaultCoverLetterTemplate: '',
  authorizedToWork: true,
  requiresSponsorship: false,
  veteranStatus: 'Not a veteran',
  disabilityStatus: 'Decline to self-identify',
  gender: 'Decline to self-identify',
  ethnicity: 'Decline to self-identify',
  willingToBackgroundCheck: true,
  willingToDrugTest: true,
  noticePeriod: '2 weeks',
  availableStartDate: 'Immediately',
  encryptedAt: new Date().toISOString(),
  version: 1,
};

describe('Identity encryption', () => {
  const testKey = 'a'.repeat(64); // 64 char hex key

  test('encrypt and decrypt roundtrip preserves data', () => {
    const encrypted = encryptIdentity(sampleIdentity, testKey);

    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.data).toBeDefined();
    expect(encrypted.version).toBe(1);

    const decrypted = decryptIdentity(encrypted, testKey);

    expect(decrypted.firstName).toBe('Test');
    expect(decrypted.lastName).toBe('User');
    expect(decrypted.email).toBe('test@example.com');
    expect(decrypted.workExperience).toHaveLength(1);
    expect(decrypted.technicalSkills).toContain('TypeScript');
  });

  test('wrong key throws IdentityDecryptionError', () => {
    const encrypted = encryptIdentity(sampleIdentity, testKey);
    const wrongKey = 'b'.repeat(64);

    expect(() => decryptIdentity(encrypted, wrongKey)).toThrow(IdentityDecryptionError);
  });

  test('encrypted data is different from plaintext', () => {
    const encrypted = encryptIdentity(sampleIdentity, testKey);
    expect(encrypted.data).not.toContain('Test User');
    expect(encrypted.data).not.toContain('test@example.com');
  });

  test('each encryption produces different ciphertext (random IV)', () => {
    const enc1 = encryptIdentity(sampleIdentity, testKey);
    const enc2 = encryptIdentity(sampleIdentity, testKey);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.data).not.toBe(enc2.data);
  });
});

describe('Identity schema validation', () => {
  test('valid identity passes validation', () => {
    const result = identitySchema.safeParse(sampleIdentity);
    expect(result.success).toBe(true);
  });

  test('missing required fields fail validation', () => {
    const invalid = { ...sampleIdentity, firstName: '' };
    const result = identitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('invalid email fails validation', () => {
    const invalid = { ...sampleIdentity, email: 'not-an-email' };
    const result = identitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('empty work experience fails validation', () => {
    const invalid = { ...sampleIdentity, workExperience: [] };
    const result = identitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
