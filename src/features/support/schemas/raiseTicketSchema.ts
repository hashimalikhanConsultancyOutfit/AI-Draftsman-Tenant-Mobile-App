import * as yup from 'yup';

/**
 * Raise ticket. Mirrors `CreateTicketDto` exactly (confirmed against
 * `apps/gateway-b2b/src/app/support/dto/support.dto.ts` 2026-09-04):
 * `customerId` required by THIS dialog even though the DTO itself makes
 * it optional — web removed the ":internal" sentinel from its own select
 * for the same reason (see `Support.data.ts`'s long comment on it), so
 * this mobile build follows that same, already-decided narrowing rather
 * than reopening it. `subject` 1..200. `body` optional, ≤20,000.
 * Attachments are NOT part of this schema — like the KB upload screen,
 * picked files live in component state, validated one at a time as
 * they're added (type/size), not as a form field.
 */
export const raiseTicketSchema = yup.object({
  customerId: yup.string().trim().required('Choose who this ticket is on behalf of.'),
  subject: yup.string().trim().required('Enter a subject.').max(200, 'Subject cannot be longer than 200 characters.'),
  body: yup.string().trim().max(20_000, 'That is too long.').default(''),
  assigneeId: yup.string().default(''),
  priority: yup.string().oneOf(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  escalate: yup.boolean().default(false),
});

export type RaiseTicketFormValues = yup.InferType<typeof raiseTicketSchema>;
