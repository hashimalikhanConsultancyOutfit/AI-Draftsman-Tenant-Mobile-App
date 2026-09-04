/**
 * Support — copy constants and pure helpers. Ported from web's
 * `Support.data.ts` / `useSupport.tsx` / `TicketDrawer.tsx` (all three
 * read in full, confirmed against source 2026-09-04), adapted to this
 * app's own tone vocabulary rather than web's `StatusTagVariant`.
 *
 * One deliberate palette gap, disclosed here rather than silently
 * papered over: web's `TICKET_STATE_VARIANT`/`MESSAGE_KIND_VARIANT` use a
 * `'purple'` tone for WITH_PLATFORM/PLATFORM_REPLY that this app's theme
 * (`src/theme/themes.ts`) does not define — it ships exactly five status
 * pairs (neutral/success/warning/error/info). Both map to `'info'`
 * below; they are never ambiguous in practice because the chip always
 * carries its own text label ("with AiDraftsman" / "AiDraftsman") right
 * beside the colour, and ANSWERED (also `'info'`) never appears in the
 * same list next to a WITH_PLATFORM chip without that label to tell them
 * apart.
 */

import type {
  SettableTicketState,
  SupportDraft,
  SupportMessageKind,
  SupportPriority,
  SupportSlaState,
  SupportTicket,
  SupportTicketState,
} from './support.types';

export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

/* --- State / priority / SLA vocabulary --------------------------------- */

export const TICKET_STATE_LABEL: Record<SupportTicketState, string> = {
  OPEN: 'open',
  ANSWERED: 'answered',
  CLOSED: 'closed',
  WITH_PLATFORM: 'with AiDraftsman',
};

export const TICKET_STATE_TONE: Record<SupportTicketState, Tone> = {
  OPEN: 'warning',
  ANSWERED: 'info',
  CLOSED: 'success',
  WITH_PLATFORM: 'info',
};

export const TICKET_STATE_RANK: Record<SupportTicketState, number> = {
  OPEN: 0,
  WITH_PLATFORM: 1,
  ANSWERED: 2,
  CLOSED: 3,
};

export const SLA_LABEL: Record<SupportSlaState, string> = {
  WITHIN: 'within SLA',
  AT_RISK: 'at risk',
  BREACHED: 'breached',
  MET: 'met',
};

export const SLA_TONE: Record<SupportSlaState, Tone> = {
  BREACHED: 'error',
  AT_RISK: 'warning',
  WITHIN: 'info',
  MET: 'success',
};

export const SLA_RANK: Record<SupportSlaState, number> = {
  BREACHED: 0,
  AT_RISK: 1,
  WITHIN: 2,
  MET: 3,
};

export const UNRANKED = Number.MAX_SAFE_INTEGER;

export const PRIORITY_LABEL: Record<SupportPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_OPTIONS = (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
  label: PRIORITY_LABEL[value],
  value,
}));

/** What a ticket is raised as when nobody says otherwise. */
export const DEFAULT_PRIORITY: SupportPriority = 'NORMAL';

/** A flag beside the subject for HIGH/URGENT only — LOW/NORMAL carry none. */
export const PRIORITY_FLAG_TONE: Record<SupportPriority, Tone | null> = {
  LOW: null,
  NORMAL: null,
  HIGH: 'warning',
  URGENT: 'error',
};

export const STATE_FILTER_OPTIONS: { label: string; value: SupportTicketState | 'ALL' }[] = [
  { label: 'All states', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Answered', value: 'ANSWERED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'With AiDraftsman', value: 'WITH_PLATFORM' },
];

/** The states offered from each current state. `WITH_PLATFORM` never
 * appears as a target — see `support.types.ts`'s `SettableTicketState`. */
export const NEXT_STATES: Record<SupportTicketState, SettableTicketState[]> = {
  OPEN: ['ANSWERED', 'CLOSED'],
  ANSWERED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
  WITH_PLATFORM: ['OPEN'],
};

export const UNASSIGNED_VALUE = ':unassigned';
export const UNASSIGNED_LABEL = 'Unassigned';

/* --- Attachments --------------------------------------------------------- */

/** Extensions offered to the document picker's UI. */
export const TICKET_ATTACHMENT_EXTENSIONS = ['.pdf', '.csv', '.xls', '.xlsx', '.png'];
/** MIME types accepted by `expo-document-picker`'s `type` filter. */
export const TICKET_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
];
export const TICKET_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Files one ticket holds in total. */
export const TICKET_ATTACHMENT_LIMIT = 10;
export const RAISE_ATTACHMENT_LIMIT = 5;
export const REPLY_ATTACHMENT_LIMIT = 5;

export const attachmentFullLabel = (limit: number): string => `Limit of ${limit} files reached`;

export const attachmentTooBigMessage = 'That file is over 10 MB — pick a smaller one.';
export const attachmentWrongTypeMessage = 'PDF, CSV, Excel (.xls/.xlsx) or PNG only.';

/* --- Messages -------------------------------------------------------------- */

export const MESSAGE_KIND_LABEL: Record<SupportMessageKind, string> = {
  TENANT_REPLY: 'Reply to customer',
  INTERNAL_NOTE: 'Internal note',
  SYSTEM_EVENT: 'System',
  CUSTOMER_MESSAGE: 'From customer',
  PLATFORM_REPLY: 'AiDraftsman',
};

export const MESSAGE_KIND_TONE: Record<SupportMessageKind, Tone> = {
  TENANT_REPLY: 'success',
  /* Amber, not neutral: the one thing this chip has to carry is "the
   * customer cannot see this row", and amber is the hue this app already
   * spends on "handled differently" rather than "something is wrong". */
  INTERNAL_NOTE: 'warning',
  SYSTEM_EVENT: 'neutral',
  CUSTOMER_MESSAGE: 'info',
  PLATFORM_REPLY: 'info',
};

/**
 * The line under a message, saying where it went. Three cases, not two:
 * an internal note names its AUDIENCE ("visible to your workspace only"),
 * while a reply names its DELIVERY — a reply the desk chose not to email
 * is still in the customer's own portal thread, just not their inbox, and
 * conflating the two would tell an agent the opposite of what is true.
 */
export const MESSAGE_FOOTER = {
  internal: 'Visible to your workspace only',
  notEmailed: 'On the ticket — not emailed',
} as const;

export const messageEmailedLabel = (iso: string): string => `Emailed ${new Date(iso).toLocaleString()}`;

/* --- Screen copy ----------------------------------------------------------- */

export const RAISE_TICKET_COPY = { title: 'Raise ticket', submitLabel: 'Raise ticket' } as const;
export const EDIT_TICKET_COPY = { title: 'Edit ticket', submitLabel: 'Save' } as const;
export const REPLY_COPY = { title: 'Reply to the customer', submitLabel: 'Send reply' } as const;
/* "Add", not "Save": a note is appended to the thread, not edited into
 * the ticket. */
export const NOTE_COPY = { title: 'Add an internal note', submitLabel: 'Add note' } as const;
export const SLA_POLICY_COPY = { title: 'Service level agreement', submitLabel: 'Save policy' } as const;

export const ESCALATE_REASON_MAX_LENGTH = 2_000;
export const ESCALATE_PRIVACY_NOTE =
  'We receive the tenant, the agent, the run id and the error. We do not receive your customer’s name or their documents unless you attach them deliberately, and we never contact your customer directly.';
export const ESCALATE_REASON_HINT =
  'Goes to the platform team. Leave your customer’s name out of it — an escalation carrying it is refused.';
export const ESCALATE_REASON_PLACEHOLDER = 'Streaming stops halfway on long runs';
export const RETURN_CONFIRM_BODY =
  'The ticket comes back to your workspace and the SLA clock starts running again from where it paused. The escalation stays on the record.';
export const DELETE_CONFIRM_BODY = 'The thread is removed. Anything already sent to the customer stays sent.';

/* --- Permission-denied captions ------------------------------------------- */

export const NO_CREATE_MESSAGE = 'Raising a ticket needs a permission your role does not hold.';
export const NO_REPLY_MESSAGE = 'Replying needs a permission your role does not hold.';
export const NO_UPDATE_MESSAGE = 'Editing a ticket needs a permission your role does not hold.';
export const NO_ESCALATE_MESSAGE = 'Escalating a ticket needs a permission your role does not hold.';
export const NO_DELETE_MESSAGE = 'Deleting a ticket needs a permission your role does not hold.';
export const NO_SLA_MANAGE_MESSAGE = 'Only a full-access role can change the service level agreement.';

/* --- Toast copy ------------------------------------------------------------- */

export const escalationToast = (subject: string, customerName?: string | null): string =>
  customerName
    ? `"${subject}" escalated and the SLA clock is paused. You remain ${customerName}'s point of contact.`
    : `"${subject}" escalated. The SLA clock is paused while it is with AiDraftsman.`;

export const returnToast = (subject: string): string => `"${subject}" is back with your workspace. The SLA clock is running again.`;

export const replyToast = (dispatched: boolean, stateLabel: string): string =>
  dispatched
    ? `Reply saved and sent to the customer. Ticket is now ${stateLabel}.`
    : `Reply saved without emailing the customer. Ticket is now ${stateLabel}.`;

/** What the reply's files did, appended to whichever toast fires. "sent
 * with it" only where the email actually went — a reply recorded without
 * emailing still has its files on the ticket, but saying they were SENT
 * would be the one place this got it wrong. */
export const attachedClause = (count: number, dispatched: boolean): string => {
  if (count === 0) return '';
  const files = `${count} file${count === 1 ? '' : 's'}`;
  return dispatched ? ` ${files} sent with it.` : ` ${files} attached to it.`;
};

export const raiseSuccessToast = (reference: string, escalated: boolean): string =>
  escalated ? `Ticket ${reference} raised successfully and escalated to AiDraftsman.` : `Ticket ${reference} raised successfully.`;

export const LINK_FAILED_MESSAGE = 'Could not open that file. The link is minted fresh each time — try again.';

/* --- Auto-reply draft ------------------------------------------------------- */

/** The same 15-second clock web ticks the countdown on. */
export const DRAFT_TICK_MS = 15_000;
export const DRAFT_PREVIEW_CHARS = 280;

/** `draft !== null && !ticket.deletedAt` — a sweep cancels the draft on
 * its own next pass for a deleted ticket, so a Stop offered there would
 * report a decision rather than make one. */
export function isDraftVisible(draft: SupportDraft | null, deletedAt: string | null): boolean {
  return draft !== null && !deletedAt;
}

/** "3 minutes" / "1h 20m" — rounds UP, because this counts toward
 * something LEAVING: "0 minutes" beside a Stop button that still works
 * would be wrong in the direction that matters. */
export function countdownLabel(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** `null` = a row with no date to count toward; a gap that has run out
 * means the sweep is due within about a minute and is still stoppable —
 * neither should read as "it has gone". */
export function draftLead(remainingMs: number | null): string {
  if (remainingMs === null) return 'An automated reply is waiting to be sent to the customer.';
  if (remainingMs > 0) return `An automated reply sends to the customer in ${countdownLabel(remainingMs)}.`;
  return 'An automated reply is due to send to the customer now.';
}

export function draftRemainingMs(sendAfter: string | null, nowMs: number): number | null {
  if (!sendAfter) return null;
  const due = new Date(sendAfter).getTime();
  if (Number.isNaN(due)) return null;
  return due - nowMs;
}

export function draftPreview(body: string | null): string {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return 'It has no text — nothing will be sent.';
  const clipped = trimmed.length > DRAFT_PREVIEW_CHARS ? `${trimmed.slice(0, DRAFT_PREVIEW_CHARS).trimEnd()}…` : trimmed;
  return `“${clipped}”`;
}

/* --- Ticket-level gates ------------------------------------------------- */

export function canBringBack(ticket: Pick<SupportTicket, 'state' | 'can'>): boolean {
  return ticket.state === 'WITH_PLATFORM' && ticket.can.update;
}

export function isUnread(ticket: Pick<SupportTicket, 'unread'>): boolean {
  return ticket.unread;
}

/* --- Misc formatting ------------------------------------------------------- */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
