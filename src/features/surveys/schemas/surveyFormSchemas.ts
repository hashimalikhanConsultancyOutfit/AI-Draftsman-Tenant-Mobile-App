/**
 * Surveys — yup schemas. Messages match web: the details form's toast
 * copy, and the schedule FormModal's "{Label} is required" for every
 * visible field (hidden fields are never validated, as `showWhen` does).
 */
import * as yup from 'yup';

import { DETAILS_COPY, isValidHhmm, isValidIsoDate, type ScheduleFormValues } from '../surveysRules';

export const surveyDetailsSchema = yup.object({
  title: yup.string().default('').trim().required(DETAILS_COPY.titleRequiredSave),
  description: yup.string().default(''),
  status: yup.string().oneOf(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).required(),
  evaluationMode: yup.string().oneOf(['AI', 'MANUAL']).required(),
  evaluationKnowledgeBaseId: yup.string().default(''),
});

const when = (test: (v: ScheduleFormValues) => boolean, schema: yup.StringSchema) =>
  yup.string().default('').test('conditional', '', function check(value) {
    const parent = this.parent as ScheduleFormValues;
    if (!test(parent)) return true;
    try {
      schema.validateSync(value);
      return true;
    } catch (err) {
      return this.createError({ message: (err as yup.ValidationError).message });
    }
  });

const recurring = (v: ScheduleFormValues) => v.mode === 'RECURRING';
const notCustom = (v: ScheduleFormValues) => recurring(v) && v.preset !== 'CUSTOM';
const intIn = (label: string, min: number, max: number) =>
  yup
    .string()
    .trim()
    .required(`${label} is required`)
    .test('int', `${label} must be a whole number from ${min} to ${max}`, (value) => {
      const n = Number(value);
      return /^\d+$/.test(String(value ?? '').trim()) && n >= min && n <= max;
    });

export const scheduleFormSchema = yup.object({
  mode: yup.string().oneOf(['ONE_TIME', 'RECURRING']).required('Delivery is required'),
  timezone: yup.string().trim().required('Timezone is required'),
  startDate: when(
    (v) => v.mode === 'ONE_TIME',
    yup.string().trim().required('Date is required').test('date', 'Enter a valid date (YYYY-MM-DD)', (value) => isValidIsoDate(value ?? '')),
  ),
  startTime: when(
    (v) => v.mode === 'ONE_TIME',
    yup.string().trim().required('Time is required').test('time', 'Enter a valid 24-hour time (HH:MM)', (value) => isValidHhmm(value ?? '')),
  ),
  preset: when(recurring, yup.string().required('Repeats is required')),
  hour: when(notCustom, intIn('Hour (0–23)', 0, 23)),
  minute: when(notCustom, intIn('Minute (0–59)', 0, 59)),
  dayOfWeek: when((v) => recurring(v) && v.preset === 'WEEKLY', yup.string().required('Day of week is required')),
  dayOfMonth: when((v) => recurring(v) && v.preset === 'MONTHLY', yup.string().required('Day of month is required')),
  customCron: when((v) => recurring(v) && v.preset === 'CUSTOM', yup.string().trim().required('Cron expression is required')),
  endCondition: when(recurring, yup.string().required('Ends is required')),
  endAt: when(
    (v) => recurring(v) && v.endCondition === 'DATE',
    yup.string().trim().required('End date is required').test('date', 'Enter a valid date (YYYY-MM-DD)', (value) => isValidIsoDate(value ?? '')),
  ),
  occurrenceLimit: when((v) => recurring(v) && v.endCondition === 'COUNT', intIn('Max occurrences', 1, 100000)),
});
