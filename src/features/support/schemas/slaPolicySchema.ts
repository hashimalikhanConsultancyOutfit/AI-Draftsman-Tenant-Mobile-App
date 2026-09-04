import * as yup from 'yup';

/**
 * Service level agreement settings. Mirrors `UpdateSlaPolicyDto` and
 * `BusinessHoursDto` exactly (confirmed against
 * `apps/gateway-b2b/src/app/support/dto/support.dto.ts` 2026-09-04):
 * every numeric field is required (this is a PUT, not a PATCH — see the
 * DTO's own comment), `atRiskPct` 1..99, `autoReplyHoldMins` 0..1440.
 * Working-hours and auto-reply fields are validated only while their
 * switch is on — `useBusinessHours`/`useAutoReply` are UI-only booleans,
 * stripped back out in `SlaPolicyFormScreen`'s submit before the PUT.
 */
export const slaPolicySchema = yup.object({
  firstResponseMins: yup.number().typeError('Enter a number.').integer().min(1, 'Must be at least 1 minute.').required(),
  resolutionMins: yup.number().typeError('Enter a number.').integer().min(1, 'Must be at least 1 minute.').required(),
  atRiskPct: yup.number().typeError('Enter a number.').integer().min(1, 'Must be between 1 and 99.').max(99, 'Must be between 1 and 99.').required(),
  pauseWhenAnswered: yup.boolean().default(true),
  useBusinessHours: yup.boolean().default(false),
  timezone: yup.string().when('useBusinessHours', {
    is: true,
    then: (schema) => schema.trim().required('Enter an IANA timezone, e.g. Europe/London.').max(64),
    otherwise: (schema) => schema.trim().default(''),
  }),
  days: yup.array().of(yup.string().required()).when('useBusinessHours', {
    is: true,
    then: (schema) => schema.min(1, 'Choose at least one working day.'),
    otherwise: (schema) => schema.default([]),
  }),
  start: yup
    .string()
    .when('useBusinessHours', {
      is: true,
      then: (schema) => schema.required().matches(/^\d{1,2}:\d{2}$/, 'Use HH:MM, e.g. 09:00.'),
      otherwise: (schema) => schema.default(''),
    }),
  end: yup
    .string()
    .when('useBusinessHours', {
      is: true,
      then: (schema) => schema.required().matches(/^\d{1,2}:\d{2}$/, 'Use HH:MM, e.g. 17:30.'),
      otherwise: (schema) => schema.default(''),
    }),
  useAutoReply: yup.boolean().default(false),
  autoReplyHoldMins: yup.number().typeError('Enter a number.').integer().min(0).max(1_440).when('useAutoReply', {
    is: true,
    then: (schema) => schema.required('Enter how long to hold it for.'),
    otherwise: (schema) => schema.default(15),
  }),
});

export type SlaPolicyFormValues = yup.InferType<typeof slaPolicySchema>;
