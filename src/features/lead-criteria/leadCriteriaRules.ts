/**
 * Lead criteria — presentation rules and copy. Ported from web's
 * `LeadCriteria.data.ts`, `useLeadCriteria.tsx`'s pure helpers, and
 * `LeadCriteriaCard.data.ts`/`useLeadCriteriaRulesDialog.tsx`.
 */
import type {
  EvaluationCriterion,
  LeadCriteriaListItem,
  LeadEvaluationField,
  LeadEvaluationOperator,
} from './leadCriteria.types';

export const LEAD_CRITERIA_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

/* -------------------------------------------------------------------------- */
/* Registry rows                                                              */
/* -------------------------------------------------------------------------- */

export interface LeadCriteriaRow {
  id: string;
  name: string;
  description: string;
  status: LeadCriteriaListItem['status'];
  ruleCount: number;
  minScore: number;
  updated: string;
  industries: string[];
  countries: string[];
  regions: string[];
  companyTypes: string[];
  employeeCountMin: number | null;
  employeeCountMax: number | null;
}

/** "2h ago" / "3 Aug 2026" — a lightweight relative-time formatter (no
 * shared one exists in this app yet outside Customers' own inline use). */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const buildLeadCriteriaRows = (sets: LeadCriteriaListItem[]): LeadCriteriaRow[] =>
  sets.map((set) => ({
    id: set.id,
    name: set.name,
    description: set.description ?? '—',
    status: set.status,
    ruleCount: set.evaluationCriteriaCount,
    minScore: set.minScore,
    updated: relativeTime(set.updatedAt),
    industries: set.industries,
    countries: set.countries,
    regions: set.regions,
    companyTypes: set.companyTypes,
    employeeCountMin: set.employeeCountMin,
    employeeCountMax: set.employeeCountMax,
  }));

/* -------------------------------------------------------------------------- */
/* Card facet preview                                                         */
/* -------------------------------------------------------------------------- */

const FACET_CHIP_LIMIT = 3;
const COMPACT_HEADCOUNT_FLOOR = 10_000;

export interface FacetPreview {
  chips: string[];
  overflowLabels: string[];
}

/** Industries lead, then countries, company types, regions — closest to
 * furthest from "who we're chasing" at a glance. */
export const buildFacetPreview = (row: LeadCriteriaRow): FacetPreview => {
  const ordered = [...row.industries, ...row.countries, ...row.companyTypes, ...row.regions];
  return { chips: ordered.slice(0, FACET_CHIP_LIMIT), overflowLabels: ordered.slice(FACET_CHIP_LIMIT) };
};

const formatBound = (value: number): string => (value >= COMPACT_HEADCOUNT_FLOOR ? value.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 }) : value.toLocaleString('en-GB'));

export const buildHeadcountLabel = (min: number | null, max: number | null): string => {
  if (min !== null && max !== null) return `${formatBound(min)}–${formatBound(max)}`;
  if (min !== null) return `${formatBound(min)}+`;
  if (max !== null) return `≤ ${formatBound(max)}`;
  return 'Any';
};

/* -------------------------------------------------------------------------- */
/* Delete / copy                                                              */
/* -------------------------------------------------------------------------- */

export const buildDeleteWarning = (name: string, ruleCount: number): string => {
  const scope = ruleCount === 0 ? 'It has no evaluation rules.' : `Its ${ruleCount} evaluation rule${ruleCount === 1 ? '' : 's'} will be deleted with it.`;
  return `“${name}” will be permanently removed. ${scope} Nothing currently reads this set — it is not used by any live scoring or lead search — so nothing else on the platform is affected.`;
};

export const LEAD_CRITERIA_MODAL_COPY = {
  create: { title: 'New lead-criteria set', submitLabel: 'Create set' },
  edit: { title: 'Edit lead-criteria set', submitLabel: 'Save changes' },
} as const;

export const NO_PERMISSION_MESSAGE = 'Your role cannot change lead criteria.';

/* -------------------------------------------------------------------------- */
/* Evaluation rules (the set's weighted rules)                                */
/* -------------------------------------------------------------------------- */

export const LEAD_EVALUATION_FIELD_LABELS: Record<LeadEvaluationField, string> = {
  INDUSTRY: 'Industry',
  COUNTRY: 'Country',
  REGION: 'Region',
  COMPANY_TYPE: 'Company type',
  EMPLOYEE_COUNT: 'Employee count',
  ANNUAL_REVENUE: 'Annual revenue',
  JOB_TITLE: 'Job title',
  SENIORITY: 'Seniority',
  DEPARTMENT: 'Department',
  TECHNOLOGY: 'Technology',
  FUNDING_STAGE: 'Funding stage',
  KEYWORD: 'Keyword',
  SOURCE: 'Source',
  STAGE: 'Stage',
};

export const LEAD_EVALUATION_OPERATOR_LABELS: Record<LeadEvaluationOperator, string> = {
  EQUALS: 'Equals',
  NOT_EQUALS: 'Not equals',
  IN: 'In (any of)',
  NOT_IN: 'Not in (none of)',
  CONTAINS: 'Contains',
  NOT_CONTAINS: 'Does not contain',
  GTE: 'At least (≥)',
  LTE: 'At most (≤)',
  BETWEEN: 'Between',
  EXISTS: 'Exists',
};

export const EVALUATION_FIELD_OPTIONS = (Object.keys(LEAD_EVALUATION_FIELD_LABELS) as LeadEvaluationField[]).map((field) => ({ label: LEAD_EVALUATION_FIELD_LABELS[field], value: field }));
export const EVALUATION_OPERATOR_OPTIONS = (Object.keys(LEAD_EVALUATION_OPERATOR_LABELS) as LeadEvaluationOperator[]).map((op) => ({ label: LEAD_EVALUATION_OPERATOR_LABELS[op], value: op }));

export const EVALUATION_WEIGHT_MIN = -100;
export const EVALUATION_WEIGHT_MAX = 100;
export const EVALUATION_LABEL_MAX = 300;

export interface RuleRow {
  id: string;
  fieldLabel: string;
  operatorLabel: string;
  value: string;
  weight: number;
  label: string;
  required: boolean;
}

/** Rule rows, ordered by their stored display position. */
export const buildRuleRows = (rules: EvaluationCriterion[]): RuleRow[] =>
  [...rules]
    .sort((a, b) => a.position - b.position)
    .map((rule) => ({
      id: rule.id,
      fieldLabel: LEAD_EVALUATION_FIELD_LABELS[rule.field],
      operatorLabel: LEAD_EVALUATION_OPERATOR_LABELS[rule.operator],
      value: rule.value,
      weight: rule.weight,
      label: rule.label,
      required: rule.required,
    }));

export const EVALUATION_RULE_MODAL_COPY = {
  add: { title: 'Add evaluation rule', submitLabel: 'Add rule' },
  edit: { title: 'Edit evaluation rule', submitLabel: 'Save changes' },
} as const;
