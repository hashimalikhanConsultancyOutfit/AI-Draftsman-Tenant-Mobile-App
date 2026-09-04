import * as yup from 'yup';

/**
 * Reply to the customer. Mirrors `ReplyDto`: `body` optional (≤20,000) —
 * a reply may be a document alone. The "body or a file" rule is enforced
 * in `ReplyFormScreen` itself, not here, since attachments live in
 * component state rather than as a form field (same pattern as raise).
 */
export const replySchema = yup.object({
  body: yup.string().trim().max(20_000, 'That is too long.').default(''),
});

export type ReplyFormValues = yup.InferType<typeof replySchema>;
