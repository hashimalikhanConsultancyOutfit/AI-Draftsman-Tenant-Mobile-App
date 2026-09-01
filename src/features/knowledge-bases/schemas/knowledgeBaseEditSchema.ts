import * as yup from 'yup';

import type { KbScope } from '../knowledgeBases.types';

/** Knowledge base create/edit form. A blank source-URL row is fine (it's
 * filtered out before submit — see `sourceUrls` in the web hook), so a row
 * only fails validation once something is typed into it that doesn't look
 * like a link. */
export const knowledgeBaseEditSchema = yup.object({
  name: yup.string().trim().required('Give this knowledge base a name'),
  scope: yup.mixed<KbScope>().oneOf(['Customer', 'Agent', 'Internal']).required(),
  agentIds: yup.array().of(yup.string().required()).defined().default([]),
  sourceUrls: yup
    .array()
    .of(
      yup.object({
        id: yup.string().optional(),
        url: yup
          .string()
          .default('')
          .test('looks-like-a-url', 'Enter a valid URL, starting with http:// or https://', (value) => !value || /^https?:\/\/.+/i.test(value)),
      }),
    )
    .defined()
    .default([]),
});

export type KnowledgeBaseEditFormValues = yup.InferType<typeof knowledgeBaseEditSchema>;
