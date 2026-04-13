export interface JobDto {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  description: string;
  applyUrl: string;
  requiresLogin: boolean;
  hasCaptcha: boolean;
  status: string;
  notifiedAt: string | null;
  repliedAt: string | null;
  appliedAt: string | null;
  failureReason: string | null;
  screenshotPath: string | null;
  coverLetterGenerated: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  applicationLogCount?: number;
}

export interface JobListResponse {
  jobs: JobDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JobDetailResponse extends JobDto {
  applicationLogs: ApplicationLogDto[];
}

export interface ApplicationLogDto {
  id: string;
  step: string;
  status: string;
  details: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface CreateManualJobRequest {
  url: string;
  title?: string;
  company?: string;
}

export interface UpdateJobStatusRequest {
  status: string;
}

export interface JobCreateInput {
  sourceId: string;
  source: string;
  title: string;
  company: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description: string;
  applyUrl: string;
  requiresLogin?: boolean;
  hasCaptcha?: boolean;
}
