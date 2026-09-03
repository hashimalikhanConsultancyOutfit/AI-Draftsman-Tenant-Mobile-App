import * as yup from 'yup';

import { UNASSIGNED_OWNER } from '../leadsRules';

/**
 * Create + Edit lead — one shared schema. Ported from web's
 * `LEAD_CREATE_FIELDS`/`LEAD_EDIT_FIELDS` (`Leads.data.ts`).
 *
 * The score/reason pair rule is the one worth calling out: a score with no
 * justification is the unauditable figure this whole screen exists to
 * prevent, and reasoning with no score describes a calculation nothing
 * performed. The API refuses both halves independently, and so does this
 * schema — `score`/`why` are each required only when the OTHER one has a
 * value, exactly mirroring `requiredWhen` on the web's field config.
 */
const isAnswered = (value: unknown): boolean => String(value ?? '').trim() !== '';

export const leadFormSchema = yup.object({
  name: yup.string().trim().required('Give the lead a title'),
  src: yup.string().trim().required('Pick a source'),
  description: yup.string().default(''),
  stage: yup.mixed<'New' | 'Enriched' | 'Qualified' | 'Contacted' | 'Won'>().oneOf(['New', 'Enriched', 'Qualified', 'Contacted', 'Won']).default('New'),
  owner: yup.string().default(UNASSIGNED_OWNER),
  score: yup
    .string()
    .default('')
    .test('is-number', 'Enter a whole number from 0 to 100', (value) => !value || (/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 100))
    .test('needs-why', 'There is no score for this reason to explain. Add the number, or clear the reason and let the scoring agent write its own.', function (value) {
      return !isAnswered(this.parent.why) || isAnswered(value);
    }),
  why: yup
    .string()
    .default('')
    .test('needs-score', 'A score needs the reasoning beside it. Say how you reached the number, or clear the score to leave the lead unscored.', function (value) {
      return !isAnswered(this.parent.score) || isAnswered(value);
    }),
});

export type LeadFormValues = yup.InferType<typeof leadFormSchema>;
