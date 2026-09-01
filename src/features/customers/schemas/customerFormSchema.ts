import * as yup from 'yup';

import { BILLING_EMAIL_PATTERN } from '../customersRules';

/**
 * Register + Edit customer form — one shared schema, mirrors
 * `AgentFormScreen`'s convention (the screen's own `isEdit` flag decides
 * which fields render and what gets submitted, not the schema).
 *
 * `email` is required in the UI on BOTH forms even though the gateway DTO
 * marks it optional — a customer imported or registered without one
 * simply can't be edited here until an address is filled in. That is
 * deliberate, ported verbatim from web (see Customers.data.ts's EDIT_FIELDS
 * comment).
 *
 * `quotaMonthly` stays a string field so the form can tell "blank" (leave
 * to gateway default on register / leave unchanged on edit) apart from
 * "0" (a real, meaningful value that blocks the customer entirely).
 */
export const customerFormSchema = yup.object({
  name: yup.string().trim().required('Give the customer a name'),
  email: yup
    .string()
    .trim()
    .required('A billing email is required')
    .matches(BILLING_EMAIL_PATTERN, 'Enter a valid email address'),
  quotaMonthly: yup
    .string()
    .default('')
    .test('is-number', 'Enter a whole number of tokens', (value) => !value || /^\d+$/.test(value)),
  showQuotaToCustomer: yup.boolean().default(false),
  portal: yup.boolean().default(false),
});

export type CustomerFormValues = yup.InferType<typeof customerFormSchema>;
