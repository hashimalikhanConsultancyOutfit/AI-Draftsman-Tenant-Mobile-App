import * as yup from 'yup';

import type { KbScope } from '../knowledgeBases.types';

/** Knowledge base create/edit form. A blank source-URL row is fine on its
 * own (it's filtered out before submit — see `sourceUrls` in the web hook),
 * so a row only fails validation once something is typed into it that
 * doesn't look like a link — but web's own `sourceUrls` field has no
 * `optional: true`, so `useFormModal` requires at least one entry overall;
 * the array-level `has-a-source` test below matches that, since submitting
 * with every row blank (or no rows at all) is a 400 from the backend's
 * `@ArrayNotEmpty()` that used to slip past this form silently. The URL
 * shape is also tightened to web's exact `/^https?:\/\/\S+$/i` — this used to
 * accept a literal space after the scheme, which web's regex (and the
 * backend's real `@IsUrl()` parser) both reject. */
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
          .test('looks-like-a-url', 'Enter a valid URL, starting with http:// or https://', (value) => !value || /^https?:\/\/\S+$/i.test(value)),
      }),
    )
    .defined()
    .default([])
    .test('has-a-source', 'Add at least one source URL', (rows) => (rows ?? []).some((row) => (row.url ?? '').trim() !== '')),
});

export type KnowledgeBaseEditFormValues = yup.InferType<typeof knowledgeBaseEditSchema>;
