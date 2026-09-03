/**
 * Lead criteria — a tenant's named, reusable definition of what a good
 * lead looks like, plus the weighted evaluation rules explaining why a
 * matching lead would be scored the way it would be. Ported from the web
 * app's `src/types/leadCriteria.types.ts` (confirmed against that source
 * and against `apps/gateway-b2b/src/app/lead-criteria/`).
 *
 * STORED-ONLY, today: nothing on the backend reads these rows yet — no
 * scoring integration, no lead-search execution. Nothing here should
 * imply a "run" or "apply to leads" capability that does not exist.
 */

export type LeadCriteriaStatus = 'ACTIVE' | 'ARCHIVED';
export const LEAD_CRITERIA_STATUSES: readonly LeadCriteriaStatus[] = ['ACTIVE', 'ARCHIVED'];

export type LeadSeniority = 'FOUNDER' | 'OWNER' | 'C_LEVEL' | 'VP' | 'DIRECTOR' | 'MANAGER' | 'SENIOR' | 'ENTRY';
export const LEAD_SENIORITIES: readonly LeadSeniority[] = ['FOUNDER', 'OWNER', 'C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'SENIOR', 'ENTRY'];

export type LeadFundingStage = 'BOOTSTRAPPED' | 'PRE_SEED' | 'SEED' | 'SERIES_A' | 'SERIES_B' | 'SERIES_C_PLUS' | 'PRIVATE_EQUITY' | 'PUBLIC';
export const LEAD_FUNDING_STAGES: readonly LeadFundingStage[] = ['BOOTSTRAPPED', 'PRE_SEED', 'SEED', 'SERIES_A', 'SERIES_B', 'SERIES_C_PLUS', 'PRIVATE_EQUITY', 'PUBLIC'];

export type LeadEvaluationField =
  | 'INDUSTRY' | 'COUNTRY' | 'REGION' | 'COMPANY_TYPE' | 'EMPLOYEE_COUNT' | 'ANNUAL_REVENUE'
  | 'JOB_TITLE' | 'SENIORITY' | 'DEPARTMENT' | 'TECHNOLOGY' | 'FUNDING_STAGE' | 'KEYWORD' | 'SOURCE' | 'STAGE';
export const LEAD_EVALUATION_FIELDS: readonly LeadEvaluationField[] = [
  'INDUSTRY', 'COUNTRY', 'REGION', 'COMPANY_TYPE', 'EMPLOYEE_COUNT', 'ANNUAL_REVENUE',
  'JOB_TITLE', 'SENIORITY', 'DEPARTMENT', 'TECHNOLOGY', 'FUNDING_STAGE', 'KEYWORD', 'SOURCE', 'STAGE',
];

/** `BETWEEN` reads `value` as two comma-separated parts (`"10,50"`);
 * `EXISTS` ignores `value` entirely. */
export type LeadEvaluationOperator = 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'NOT_CONTAINS' | 'GTE' | 'LTE' | 'BETWEEN' | 'EXISTS';
export const LEAD_EVALUATION_OPERATORS: readonly LeadEvaluationOperator[] = ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS', 'GTE', 'LTE', 'BETWEEN', 'EXISTS'];

/** One weighted rule inside a set. `label` is the sentence explaining why
 * the rule matters — the thing worth reading first. */
export interface EvaluationCriterion {
  id: string;
  field: LeadEvaluationField;
  operator: LeadEvaluationOperator;
  value: string;
  /** -100..100. Default 0. */
  weight: number;
  /** Required, max 300 characters. */
  label: string;
  /** A failed required rule disqualifies rather than deducts. */
  required: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationCriterionInput {
  field: LeadEvaluationField;
  operator: LeadEvaluationOperator;
  value: string;
  label: string;
  weight?: number;
  required?: boolean;
  position?: number;
}

/** The DETAIL shape — `GET /lead-criteria/:id` and create/update. */
export interface LeadCriteriaSet {
  id: string;
  name: string;
  description: string | null;
  status: LeadCriteriaStatus;
  industries: string[];
  countries: string[];
  regions: string[];
  companyTypes: string[];
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  /** Decimal as a string, e.g. `"1000000"`. */
  annualRevenueMin: string | null;
  annualRevenueMax: string | null;
  /** 3-letter ISO code, e.g. `"GBP"`. Default `"GBP"`. */
  revenueCurrency: string;
  jobTitles: string[];
  seniorities: LeadSeniority[];
  departments: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  excludeDomains: string[];
  technologies: string[];
  fundingStages: LeadFundingStage[];
  hiringSignal: boolean;
  recentFundingWithinDays: number | null;
  /** Free text — not the fixed source list Leads uses. Describes what a
   * tenant is looking FOR, not a channel a lead has arrived through. */
  sources: string[];
  minScore: number;
  autoQualifyScore: number | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  evaluationCriteria: EvaluationCriterion[];
}

/** The registry row — every field of `LeadCriteriaSet` except its rules
 * array, plus a count of them. */
export type LeadCriteriaListItem = Omit<LeadCriteriaSet, 'evaluationCriteria'> & {
  evaluationCriteriaCount: number;
};

export interface LeadCriteriaPage {
  items: LeadCriteriaListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadCriteriaListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  /** Omitted returns ACTIVE only. */
  status?: LeadCriteriaStatus;
}

/**
 * `POST/PATCH /lead-criteria` body. Every nullable field on
 * `LeadCriteriaSet` stays nullable: omitting a key on the PATCH means
 * "leave unchanged", sending `null` explicitly clears it.
 */
export interface CreateLeadCriteriaRequest {
  name: string;
  description?: string | null;
  status?: LeadCriteriaStatus;
  industries?: string[];
  countries?: string[];
  regions?: string[];
  companyTypes?: string[];
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
  annualRevenueMin?: string | null;
  annualRevenueMax?: string | null;
  revenueCurrency?: string;
  jobTitles?: string[];
  seniorities?: LeadSeniority[];
  departments?: string[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
  excludeDomains?: string[];
  technologies?: string[];
  fundingStages?: LeadFundingStage[];
  hiringSignal?: boolean;
  recentFundingWithinDays?: number | null;
  sources?: string[];
  minScore?: number;
  autoQualifyScore?: number | null;
}

export interface UpdateLeadCriteriaRequest extends Partial<CreateLeadCriteriaRequest> {
  id: string;
}

export interface AddEvaluationCriterionRequest extends EvaluationCriterionInput {
  leadCriteriaId: string;
}

export interface UpdateEvaluationCriterionRequest extends Partial<EvaluationCriterionInput> {
  leadCriteriaId: string;
  criterionId: string;
}

export interface RemoveEvaluationCriterionRequest {
  leadCriteriaId: string;
  criterionId: string;
}

export type LeadCriteriaModal = 'create' | 'edit' | 'delete' | null;
