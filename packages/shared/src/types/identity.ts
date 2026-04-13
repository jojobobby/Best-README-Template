import { z } from 'zod';

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string; // MM/YYYY
  endDate: string | 'Present';
  location: string;
  description: string;
  achievements: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string | 'Present';
  gpa?: string;
  honors?: string[];
}

export interface Identity {
  // Personal
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  phoneFormatted: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  // Professional
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  currentTitle: string;
  yearsOfExperience: number;
  summary: string;

  // Work history
  workExperience: WorkExperience[];
  education: Education[];

  // Skills
  technicalSkills: string[];
  softSkills: string[];
  certifications: string[];
  languages: string[];

  // Job preferences
  desiredSalaryMin: number;
  desiredSalaryMax: number;
  willingToRelocate: boolean;
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'any';
  preferredLocations: string[];

  // Application assets
  resumePath: string;
  resumeText: string;
  defaultCoverLetterTemplate: string;

  // Common application answers
  authorizedToWork: boolean;
  requiresSponsorship: boolean;
  veteranStatus: string;
  disabilityStatus: string;
  gender: string;
  ethnicity: string;
  willingToBackgroundCheck: boolean;
  willingToDrugTest: boolean;
  noticePeriod: string;
  availableStartDate: string;

  // Security
  encryptedAt: string;
  version: number;
}

const workExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().regex(/^\d{2}\/\d{4}$/, 'Must be MM/YYYY'),
  endDate: z.union([z.string().regex(/^\d{2}\/\d{4}$/), z.literal('Present')]),
  location: z.string(),
  description: z.string(),
  achievements: z.array(z.string()),
});

const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().min(1),
  startDate: z.string(),
  endDate: z.union([z.string(), z.literal('Present')]),
  gpa: z.string().optional(),
  honors: z.array(z.string()).optional(),
});

export const identitySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  phoneFormatted: z.string(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(3),
    country: z.string().min(1),
  }),
  linkedinUrl: z.string().url().or(z.literal('')),
  githubUrl: z.string().url().or(z.literal('')),
  portfolioUrl: z.string().url().or(z.literal('')),
  currentTitle: z.string().min(1),
  yearsOfExperience: z.number().min(0),
  summary: z.string().min(10),
  workExperience: z.array(workExperienceSchema).min(1),
  education: z.array(educationSchema).min(1),
  technicalSkills: z.array(z.string()).min(1),
  softSkills: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  desiredSalaryMin: z.number().min(0),
  desiredSalaryMax: z.number().min(0),
  willingToRelocate: z.boolean(),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite', 'any']),
  preferredLocations: z.array(z.string()),
  resumePath: z.string(),
  resumeText: z.string().min(10),
  defaultCoverLetterTemplate: z.string(),
  authorizedToWork: z.boolean(),
  requiresSponsorship: z.boolean(),
  veteranStatus: z.string(),
  disabilityStatus: z.string(),
  gender: z.string(),
  ethnicity: z.string(),
  willingToBackgroundCheck: z.boolean(),
  willingToDrugTest: z.boolean(),
  noticePeriod: z.string(),
  availableStartDate: z.string(),
  encryptedAt: z.string(),
  version: z.number(),
});
