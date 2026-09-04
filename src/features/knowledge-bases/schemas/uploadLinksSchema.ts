import * as yup from 'yup';

import { MAX_UPLOAD_LINKS, validatePublicLink } from '../knowledgeBaseRules';

/** The "Add links" side of the upload screen. A blank row is fine — it's
 * dropped before submit — so a row only fails once it holds text that
 * `validatePublicLink` rejects (same SSRF-guard rules the web upload
 * modal enforces: http/https only, no credentials, no local/private
 * addresses). Capped at `MAX_UPLOAD_LINKS` rows, matching web's own
 * "Add another link" button, which disables itself at the same count. */
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
    .max(MAX_UPLOAD_LINKS, `Add at most ${MAX_UPLOAD_LINKS} links at a time`)
    .default([{ url: '' }]),
});

export type UploadLinksFormValues = yup.InferType<typeof uploadLinksSchema>;
