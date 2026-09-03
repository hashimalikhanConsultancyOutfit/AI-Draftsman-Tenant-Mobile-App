import * as yup from 'yup';

import { EVALUATION_LABEL_MAX, EVALUATION_WEIGHT_MAX, EVALUATION_WEIGHT_MIN } from '../leadCriteriaRules';
import type { LeadEvaluationField, LeadEvaluationOperator } from '../leadCriteria.types';

/**
 * Add/Edit one evaluation rule. `value` is optional — `EXISTS` ignores it
 * entirely and the API is happy with `""`. `position` is deliberately
 * absent — the backend defaults it to append order and there is no
 * reorder UI here, matching web.
 */
export const evaluationRuleSchema = yup.object({
  field: yup.mixed<LeadEvaluationField>().required(),
  operator: yup.mixed<LeadEvaluationOperator>().required(),
  value: yup.string().default(''),
  label: yup.string().trim().required('Say why this rule matters').max(EVALUATION_LABEL_MAX, `Keep the label under ${EVALUATION_LABEL_MAX} characters`),
  weight: yup
    .string()
    .default('0')
    .test('in-range', `Weight must be between ${EVALUATION_WEIGHT_MIN} and ${EVALUATION_WEIGHT_MAX}`, (value) => {
      if (!value || value.trim() === '') return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= EVALUATION_WEIGHT_MIN && n <= EVALUATION_WEIGHT_MAX;
    }),
  required: yup.boolean().default(false),
});

export type EvaluationRuleFormValues = yup.InferType<typeof evaluationRuleSchema>;
