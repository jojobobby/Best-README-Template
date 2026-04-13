export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  required: boolean;
  options?: string[];
  semanticMeaning: SemanticFieldMeaning;
}

export type SemanticFieldMeaning =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'linkedinUrl'
  | 'githubUrl'
  | 'portfolioUrl'
  | 'currentTitle'
  | 'currentCompany'
  | 'resumeUpload'
  | 'coverLetter'
  | 'coverLetterUpload'
  | 'yearsExperience'
  | 'currentSalary'
  | 'desiredSalary'
  | 'workAuthorization'
  | 'requiresSponsorship'
  | 'veteranStatus'
  | 'gender'
  | 'ethnicity'
  | 'disabilityStatus'
  | 'startDate'
  | 'noticePeriod'
  | 'referral'
  | 'website'
  | 'customQuestion';

export interface FillInstruction {
  selector: string;
  value: string;
  type: 'type' | 'select' | 'radio' | 'checkbox' | 'file';
  label: string;
}

export interface ApplyTaskPayload {
  jobId: string;
  priority: 'normal' | 'high';
}

export interface ApplyResult {
  success: boolean;
  confirmationText?: string;
  screenshotPath?: string;
  error?: string;
}

export type LogStepFn = (
  step: string,
  status: 'SUCCESS' | 'FAILURE' | 'SKIPPED',
  details?: string,
  durationMs?: number,
) => Promise<void>;
