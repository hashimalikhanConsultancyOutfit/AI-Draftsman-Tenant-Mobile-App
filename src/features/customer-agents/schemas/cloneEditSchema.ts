import * as yup from 'yup';

/** Clone edit form — Customer/Cloned-from are read-only and not part of
 * this schema. Model is the one field a clone cannot run without; tools,
 * prompt and note stay optional since clearing one back to the master's
 * value (or blank) is a legitimate way to resolve divergence. */
export const cloneEditSchema = yup.object({
  model: yup.string().trim().required('A clone needs a model'),
  tools: yup.string().default(''),
  prompt: yup.string().default(''),
  note: yup.string().default(''),
});

export type CloneEditFormValues = yup.InferType<typeof cloneEditSchema>;
