import * as yup from 'yup';

import type { LeadCriteriaSet } from '../leadCriteria.types';

/**
 * Create + Edit lead-criteria set — one shared schema/value shape, ported
 * from web's `LeadCriteriaFormDialog.data.ts` (`leadCriteriaSchema`,
 * `toFormValues`, `toLeadCriteriaRequest`). 25 fields across 6 sections:
 * Identity, Firmographics, Contact targeting, Keywords & exclusions,
 * Signals & intent, Thresholds.
 *
 * Every field here is a concrete, controlled value — `''`/`[]`, never
 * `undefined` — matching the web form's own value shape, which is
 * deliberately NOT the request shape (see `toLeadCriteriaRequest` below
 * for the one-directional mapping).
 */

export const ARRAY_MAX_ITEMS = 50;
export const ARRAY_ITEM_MAX_CHARS = 120;
export const LEAD_CRITERIA_NAME_MAX = 160;
export const LEAD_CRITERIA_DESCRIPTION_MAX = 2000;
export const DECIMAL_STRING_PATTERN = /^\d+(\.\d{1,2})?$/;
export const REVENUE_CURRENCY_PATTERN = /^[A-Z]{3}$/;

const stringArray = () => yup.array().of(yup.string().trim().max(ARRAY_ITEM_MAX_CHARS, `Keep each entry under ${ARRAY_ITEM_MAX_CHARS} characters`).required()).max(ARRAY_MAX_ITEMS, `At most ${ARRAY_MAX_ITEMS} entries`).default([]);

const blankToUndefined = (value: unknown, originalValue: unknown) =>
  originalValue === null || originalValue === undefined || (typeof originalValue === 'string' && originalValue.trim() === '') ? undefined : value;

const nonNegativeInt = (label: string) => yup.number().transform(blankToUndefined).typeError(`${label} must be a whole number`).integer(`${label} must be a whole number`).min(0, `${label} cannot be negative`).optional();

const decimalString = (label: string) => yup.string().trim().matches(DECIMAL_STRING_PATTERN, { message: `${label} must be a plain number, e.g. 1000000 or 1000000.50`, excludeEmptyString: true }).optional();

export const leadCriteriaSchema = yup.object({
  name: yup.string().trim().required('Name is required').max(LEAD_CRITERIA_NAME_MAX, `Keep the name under ${LEAD_CRITERIA_NAME_MAX} characters`),
  description: yup.string().trim().max(LEAD_CRITERIA_DESCRIPTION_MAX, `Keep the description under ${LEAD_CRITERIA_DESCRIPTION_MAX} characters`).default(''),
  status: yup.mixed<'ACTIVE' | 'ARCHIVED'>().oneOf(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),

  industries: stringArray(),
  countries: stringArray(),
  regions: stringArray(),
  companyTypes: stringArray(),

  employeeCountMin: nonNegativeInt('Minimum employees'),
  employeeCountMax: nonNegativeInt('Maximum employees').test('gte-employee-min', 'Maximum employees must be at least the minimum', function (value) {
    const min = this.parent.employeeCountMin;
    if (value === undefined || min === undefined || min === '') return true;
    return value >= min;
  }),

  annualRevenueMin: decimalString('Minimum annual revenue'),
  annualRevenueMax: decimalString('Maximum annual revenue').test('gte-revenue-min', 'Maximum annual revenue must be at least the minimum', function (value) {
    const min = this.parent.annualRevenueMin;
    if (!value || !min) return true;
    return Number(value) >= Number(min);
  }),
  revenueCurrency: yup.string().trim().transform((v) => (typeof v === 'string' ? v.toUpperCase() : v)).required('Currency is required').matches(REVENUE_CURRENCY_PATTERN, 'Use a 3-letter ISO code, e.g. GBP').default('GBP'),

  jobTitles: stringArray(),
  seniorities: yup.array().of(yup.string().required()).default([]),
  departments: stringArray(),

  includeKeywords: stringArray(),
  excludeKeywords: stringArray(),
  excludeDomains: stringArray(),
  technologies: stringArray(),

  fundingStages: yup.array().of(yup.string().required()).default([]),
  hiringSignal: yup.boolean().default(false),
  recentFundingWithinDays: nonNegativeInt('Recent funding window'),
  sources: stringArray(),

  minScore: yup.number().transform(blankToUndefined).typeError('Minimum score must be a number').min(0, 'Minimum score cannot be below 0').max(100, 'Minimum score cannot be above 100').default(0),
  autoQualifyScore: yup
    .number()
    .transform(blankToUndefined)
    .typeError('Auto-qualify score must be a number')
    .min(0, 'Auto-qualify score cannot be below 0')
    .max(100, 'Auto-qualify score cannot be above 100')
    .optional()
    .test('gte-min-score', 'Auto-qualify score must be at least the minimum score', function (value) {
      if (value === undefined) return true;
      const min = this.parent.minScore;
      return value >= (min === '' || min === undefined ? 0 : min);
    }),
});

export type LeadCriteriaFormValues = {
  name: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  industries: string[];
  countries: string[];
  regions: string[];
  companyTypes: string[];
  employeeCountMin: number | '';
  employeeCountMax: number | '';
  annualRevenueMin: string;
  annualRevenueMax: string;
  revenueCurrency: string;
  jobTitles: string[];
  seniorities: string[];
  departments: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  excludeDomains: string[];
  technologies: string[];
  fundingStages: string[];
  hiringSignal: boolean;
  recentFundingWithinDays: number | '';
  sources: string[];
  minScore: number | '';
  autoQualifyScore: number | '';
};

export const LEAD_CRITERIA_FORM_DEFAULTS: LeadCriteriaFormValues = {
  name: '',
  description: '',
  status: 'ACTIVE',
  industries: [],
  countries: [],
  regions: [],
  companyTypes: [],
  employeeCountMin: '',
  employeeCountMax: '',
  annualRevenueMin: '',
  annualRevenueMax: '',
  revenueCurrency: 'GBP',
  jobTitles: [],
  seniorities: [],
  departments: [],
  includeKeywords: [],
  excludeKeywords: [],
  excludeDomains: [],
  technologies: [],
  fundingStages: [],
  hiringSignal: false,
  recentFundingWithinDays: '',
  sources: [],
  minScore: 0,
  autoQualifyScore: '',
};

/** Seed the form from an existing row, for the edit screen. */
export const toFormValues = (set: LeadCriteriaSet): LeadCriteriaFormValues => ({
  name: set.name,
  description: set.description ?? '',
  status: set.status,
  industries: set.industries,
  countries: set.countries,
  regions: set.regions,
  companyTypes: set.companyTypes,
  employeeCountMin: set.employeeCountMin ?? '',
  employeeCountMax: set.employeeCountMax ?? '',
  annualRevenueMin: set.annualRevenueMin ?? '',
  annualRevenueMax: set.annualRevenueMax ?? '',
  revenueCurrency: set.revenueCurrency,
  jobTitles: set.jobTitles,
  seniorities: set.seniorities,
  departments: set.departments,
  includeKeywords: set.includeKeywords,
  excludeKeywords: set.excludeKeywords,
  excludeDomains: set.excludeDomains,
  technologies: set.technologies,
  fundingStages: set.fundingStages,
  hiringSignal: set.hiringSignal,
  recentFundingWithinDays: set.recentFundingWithinDays ?? '',
  sources: set.sources,
  minScore: set.minScore,
  autoQualifyScore: set.autoQualifyScore ?? '',
});

const blankToNull = (value: number | '' | undefined): number | null => (value === '' || value === undefined ? null : value);

/**
 * Map validated form values onto the request shape. `status` is included
 * ONLY on edit — the gateway's create DTO has no `status` key at all
 * (`forbidNonWhitelisted`) since a set is always born ACTIVE.
 */
export const toLeadCriteriaRequest = (values: LeadCriteriaFormValues, mode: 'create' | 'edit') => ({
  name: values.name,
  description: values.description.trim() ? values.description.trim() : null,
  ...(mode === 'edit' ? { status: values.status } : {}),
  industries: values.industries,
  countries: values.countries,
  regions: values.regions,
  companyTypes: values.companyTypes,
  employeeCountMin: blankToNull(values.employeeCountMin),
  employeeCountMax: blankToNull(values.employeeCountMax),
  annualRevenueMin: values.annualRevenueMin.trim() || null,
  annualRevenueMax: values.annualRevenueMax.trim() || null,
  revenueCurrency: values.revenueCurrency.trim().toUpperCase(),
  jobTitles: values.jobTitles,
  seniorities: values.seniorities as LeadCriteriaSet['seniorities'],
  departments: values.departments,
  includeKeywords: values.includeKeywords,
  excludeKeywords: values.excludeKeywords,
  excludeDomains: values.excludeDomains,
  technologies: values.technologies,
  fundingStages: values.fundingStages as LeadCriteriaSet['fundingStages'],
  hiringSignal: values.hiringSignal,
  recentFundingWithinDays: blankToNull(values.recentFundingWithinDays),
  sources: values.sources,
  minScore: values.minScore === '' ? 0 : values.minScore,
  autoQualifyScore: blankToNull(values.autoQualifyScore),
});
