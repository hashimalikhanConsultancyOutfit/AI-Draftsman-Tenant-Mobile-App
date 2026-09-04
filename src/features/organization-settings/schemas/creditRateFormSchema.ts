import * as yup from 'yup';

import { MAX_SELL_POUNDS_PER_CREDIT } from '../organizationSettingsRules';

/**
 * The rate dialog's one field. Mirrors `SetCreditRateDto` exactly
 * (confirmed against that source 2026-09-04): a non-negative number, at
 * most two decimal places (whole pence once converted), capped at
 * `MAX_SELL_PENCE_PER_CREDIT`. Zero is a legitimate price — giving
 * credits away is a real choice — so this is `required` in the sense of
 * "must be a number the field can parse", not "must be nonzero".
 */
export const creditRateFormSchema = yup.object({
  sellPerCredit: yup
    .string()
    .trim()
    .required('Enter what one credit costs your customer.')
    .test('is-number', 'Enter a valid amount.', (value) => value !== undefined && value !== '' && !Number.isNaN(Number(value)))
    .test('non-negative', 'The price per credit cannot be negative.', (value) => Number(value) >= 0)
    .test('two-decimals', 'Enter at most two decimal places.', (value) => {
      if (value === undefined) return true;
      const n = Number(value);
      return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
    })
    .test('within-ceiling', 'That is far beyond any real price for one credit — check whether pounds were entered instead of pence.', (value) => Number(value) <= MAX_SELL_POUNDS_PER_CREDIT),
});

export type CreditRateFormValues = yup.InferType<typeof creditRateFormSchema>;
