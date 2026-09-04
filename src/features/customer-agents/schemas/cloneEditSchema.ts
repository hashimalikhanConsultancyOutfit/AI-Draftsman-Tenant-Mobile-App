import * as yup from 'yup';

/** Clone edit form — Customer/Cloned-from are read-only and not part of
 * this schema. Model, tools and prompt are all required non-blank — matches
 * web's `CLONE_EDIT_FIELDS` (`CustomerAgents.data.ts`), where only `note`
 * carries `optional: true`. Corrected from an earlier version of this schema
 * that also let tools/prompt go blank; web does not allow that, so neither
 * should this form — a divergence gets resolved by setting a value, not by
 * clearing the field entirely. */
export const cloneEditSchema = yup.object({
  model: yup.string().trim().required('A clone needs a model'),
  tools: yup.string().trim().required('List the tools this clone can use'),
  prompt: yup.string().trim().required('A clone needs a system prompt'),
  note: yup.string().default(''),
});

export type CloneEditFormValues = yup.InferType<typeof cloneEditSchema>;
