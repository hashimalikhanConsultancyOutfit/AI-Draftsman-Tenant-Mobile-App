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
  /* Required non-blank — matches web's `AGENT_DEFINITION_FIELDS.tools`, which
   * has no `optional: true` and so is required by `useFormModal`'s default
   * text-field path. */
  tools: yup.string().trim().required('List the tools this agent can use'),
  memory: yup.mixed<AgentMemory>().oneOf(['NO_MEMORY', 'SHORT_TERM', 'LONG_TERM']).required(),
  kbIds: yup.array().of(yup.string().required()).defined().default([]),
  /* Required non-blank — matches web's `buildAgentDefinitionFields.prompt`
   * (`agentDefinitionFields.ts`), which carries no `optional: true` either.
   * The prompt is part of what the evaluation gate hashes alongside model
   * and tools, so an agent saved without one would have nothing for a gate
   * pass to actually be about. */
  prompt: yup.string().trim().required('Write a system prompt for this agent'),
  mode: yup.mixed<AgentPricingMode>().oneOf(['INCLUDED', 'PER_RUN', 'PER_TOKEN']).required(),
  /* Optional — matches web's `AGENT_PRICING_FIELDS.price` (`optional: true`)
   * and the backend's `@IsOptional() unitPriceCents`. A pricing mode of
   * `INCLUDED` has no per-run/per-token charge, so nothing should force a
   * price into it. */
  price: yup
    .string()
    .test('is-number', 'Enter a valid price', (value) => value === undefined || value === '' || Number.isFinite(Number(value)))
    .test('non-negative', 'Price cannot be negative', (value) => value === undefined || value === '' || Number(value) >= 0),
  isSupportAgent: yup.boolean().default(false),
  note: yup.string().default(''),
});

export type AgentFormValues = yup.InferType<typeof agentFormSchema>;
