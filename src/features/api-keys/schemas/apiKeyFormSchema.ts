import * as yup from 'yup';

/** Mirrors `CreateApiKeyDto`/`UpdateApiKeyDto` — name and policy only. The
 * spend cap, rate limits and IP rules all live on the policy, never here. */
export const apiKeyFormSchema = yup.object({
  name: yup.string().trim().min(1, 'Enter a name.').max(120, 'Keep it under 120 characters.').required('Enter a name.'),
  policyId: yup.string().required('Choose a policy.'),
});

export type ApiKeyFormValues = yup.InferType<typeof apiKeyFormSchema>;
