import * as yup from 'yup';

import type { AgentMemory, AgentPricingMode } from '../companyAgents.types';

/** Company agent create/edit form. Mirrors the inline checks the screen
 * used to do by hand (name required, a model must be selected) plus a
 * sanity check on price, shown the same way the auth schemas are:
 * required-field messages resolved by react-hook-form and rendered below
 * each field. */
export const agentFormSchema = yup.object({
  name: yup.string().trim().required('Give the agent a name'),
  modelSlug: yup.string().required('Select a lab and a model before saving'),
  tools: yup.string().default(''),
  memory: yup.mixed<AgentMemory>().oneOf(['NO_MEMORY', 'SHORT_TERM', 'LONG_TERM']).required(),
  kbIds: yup.array().of(yup.string().required()).defined().default([]),
  prompt: yup.string().default(''),
  mode: yup.mixed<AgentPricingMode>().oneOf(['INCLUDED', 'PER_RUN', 'PER_TOKEN']).required(),
  price: yup
    .string()
    .required('Enter a unit price')
    .test('is-number', 'Enter a valid price', (value) => value !== undefined && value !== '' && Number.isFinite(Number(value)))
    .test('non-negative', 'Price cannot be negative', (value) => value === undefined || value === '' || Number(value) >= 0),
  isSupportAgent: yup.boolean().default(false),
  note: yup.string().default(''),
});

export type AgentFormValues = yup.InferType<typeof agentFormSchema>;
