import * as yup from 'yup';

import { validatePublicLink } from '../knowledgeBaseRules';

/** The "Add links" side of the upload screen. A blank row is fine — it's
 * dropped before submit — so a row only fails once it holds text that
 * `validatePublicLink` rejects (same SSRF-guard rules the web upload
 * modal enforces: http/https only, no credentials, no local/private
 * addresses). */
export const uploadLinksSchema = yup.object({
  links: yup
    .array()
    .of(
      yup.object({
        url: yup.string().default('').test('valid-public-link', function validLink(value) {
          if (!value?.trim()) return true;
          const problem = validatePublicLink(value.trim());
          return problem ? this.createError({ message: problem }) : true;
        }),
      }),
    )
    .defined()
    .default([{ url: '' }]),
});

export type UploadLinksFormValues = yup.InferType<typeof uploadLinksSchema>;
