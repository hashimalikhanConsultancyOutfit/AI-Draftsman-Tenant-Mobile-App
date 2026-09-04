import * as yup from 'yup';

/**
 * Edit ticket. Mirrors `UpdateTicketDto` (confirmed 2026-09-04): subject
 * 1..200, priority one of the four, `state` one of `SETTABLE_TICKET_STATES`
 * PLUS `'WITH_PLATFORM'` — chosen here to mean "escalate", routed to the
 * escalate endpoint instead of a PATCH by `TicketFormScreen` itself, the
 * same rule web's `submitEdit` applies (see `supportRules.ts`'s module
 * doc). `assigneeId` is a plain string here (`UNASSIGNED_VALUE` sentinel
 * for "no owner"), translated to `string | null` at submit time.
 */
export const editTicketSchema = yup.object({
  subject: yup.string().trim().required('Enter a subject.').max(200, 'Subject cannot be longer than 200 characters.'),
  assigneeId: yup.string().default(''),
  priority: yup.string().oneOf(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  state: yup.string().oneOf(['OPEN', 'ANSWERED', 'CLOSED', 'WITH_PLATFORM']).required(),
});

export type EditTicketFormValues = yup.InferType<typeof editTicketSchema>;
