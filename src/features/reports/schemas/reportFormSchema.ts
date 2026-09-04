/**
 * Reports — create/edit schema. Validates only what the option-list pickers
 * cannot already guarantee (every select is constrained to a closed list,
 * so there is nothing to validate there beyond it having a value at all):
 * the report's name, the free-typed date/time pair, and the CUSTOM cadence's
 * interval — bounds match `report.dto.ts` exactly (confirmed 2026-09-03).
 */

import * as yup from 'yup';

import { hhmmToMinutes, isValidIsoDate } from '../reportsRules';

export const reportFormSchema = yup.object({
  name: yup.string().trim().required('Enter a report name').max(120, 'Keep it under 120 characters'),
  frequency: yup.string().required(),
  onceDate: yup
    .string()
    .default('')
    .test('valid-date', 'Enter a valid date (YYYY-MM-DD)', (value) => !value || isValidIsoDate(value)),
  dayOfWeek: yup.string().required(),
  dayOfMonth: yup.string().required(),
  monthOfYear: yup.string().required(),
  quarterStart: yup.string().required(),
  intervalDays: yup
    .string()
    .required('Enter a number of days')
    .test('in-range', '1 to 365 days', (value) => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 365;
    }),
  runAtMinute: yup
    .string()
    .required('Enter a time')
    .test('valid-time', 'Enter a valid 24-hour time (HH:MM)', (value) => hhmmToMinutes(value ?? '') !== null),
  /* Web's `REPORT_FIELDS.dims` carries no `optional: true`, so `useFormModal`
   * requires at least one selection — this form let it through empty, and
   * the backend's own DTO happily accepts `dims: []` too (no
   * `@ArrayNotEmpty`), so nothing downstream would have caught a report
   * saved with no grouping at all. */
  dims: yup.array().of(yup.string().required()).default([]).min(1, 'Choose at least one way to group the report'),
  dest: yup.string().required(),
});

export type ReportFormSchemaValues = yup.InferType<typeof reportFormSchema>;
