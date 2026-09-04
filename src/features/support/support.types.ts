/**
 * Support — the wire contract with `gateway-b2b`. Mirrors
 * `apps/gateway-b2b/src/app/support/dto/support.dto.ts` and web's own
 * `src/types/support.types.ts` (both read in full, confirmed against
 * source 2026-09-04).
 *
 * Two properties shape everything below, straight from the backend:
 *
 *  - THE SERVER SHIPS LABELS. `raisedLabel`, `sla.label`, `owner.label`
 *    arrive ready to render — nothing here holds a clock or reimplements
 *    the rounding. Raw timestamps travel alongside for the one thing that
 *    DOES tick locally on this screen: the auto-reply draft countdown.
 *  - THE SERVER SHIPS PERMISSIONS. Each row carries `can`, resolved from
 *    the caller's role, so the UI renders the actions the API will
 *    actually accept rather than guessing from a client-side role.
 *
 * Dates arrive as ISO strings.
 */

/* --- Enumerations ----------------------------------------------------- */

export const SUPPORT_TICKET_STATES = ['OPEN', 'ANSWERED', 'CLOSED', 'WITH_PLATFORM'] as const;
export type SupportTicketState = (typeof SUPPORT_TICKET_STATES)[number];

/** The states a client may ask for. `WITH_PLATFORM` is absent on purpose —
 * escalation is the only way in. */
export const SETTABLE_TICKET_STATES = ['OPEN', 'ANSWERED', 'CLOSED'] as const;
export type SettableTicketState = (typeof SETTABLE_TICKET_STATES)[number];

export const SUPPORT_SLA_STATES = ['WITHIN', 'AT_RISK', 'BREACHED', 'MET'] as const;
export type SupportSlaState = (typeof SUPPORT_SLA_STATES)[number];

export const SUPPORT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export type SupportOwnerKind = 'UNASSIGNED' | 'TENANT_USER' | 'PLATFORM';

/* --- Read models -------------------------------------------------------- */

export interface SupportSlaView {
  state: SupportSlaState;
  /** "within SLA" | "1h left" | "breached" | "met" — ready to render. */
  label: string;
  /** The original promise. Pause is not folded in; see `effectiveDueAt`. */
  firstResponseDueAt: string;
  /** `firstResponseDueAt` plus accumulated pause — what AT_RISK counts down to. */
  effectiveDueAt: string;
  minutesRemaining: number | null;
}

export interface SupportOwnerView {
  id: string | null;
  label: string;
  kind: SupportOwnerKind;
}

/** What the caller's role permits on THIS ticket. */
export interface SupportTicketPermissions {
  /** Edit — subject, owner, state. `support.update`. */
  update: boolean;
  reply: boolean;
  escalate: boolean;
  delete: boolean;
}

/** The newest escalation on a ticket. Distinct from `escalated` (holds it
 * RIGHT NOW) — this survives the return trip. */
export interface SupportEscalationView {
  id: string;
  /** `REQUESTED` today. */
  state: string;
  reason: string | null;
  requestedAt: string;
  requestedLabel: string;
}

/** One file attached to a ticket. No URL, ever — opening one mints a link
 * good for minutes via its own request. */
export interface SupportAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** "412 KB" | "1.4 MB" — computed server-side. */
  sizeLabel: string;
  uploadedAt: string;
}

/** One row of the inbox. */
export interface SupportTicket {
  id: string;
  /** Tenant-scoped human reference, e.g. `NOR-1042`. */
  reference: string;
  /** `null` for an internal ticket raised on nobody's behalf. */
  customer: { id: string; name: string } | null;
  subject: string;
  raisedAt: string;
  raisedLabel: string;
  /**
   * A concurrency token, not a display field — sent straight back as
   * `expectedUpdatedAt` on an edit, so a write that lost a race is
   * refused with 409 rather than quietly overwriting whoever won.
   */
  updatedAt: string;
  sla: SupportSlaView;
  /** When the desk owes its NEXT reply. Separate from `sla`, which is
   * about the FIRST response and carries a settled verdict. Null when
   * nothing dated is owed. */
  nextResponseDueAt: string | null;
  owner: SupportOwnerView;
  state: SupportTicketState;
  priority: SupportPriority;
  /** The platform team holds it right now. See `escalation` for history. */
  escalated: boolean;
  escalation: SupportEscalationView | null;
  /** The customer has said something nobody at the desk has opened since.
   * Resolved server-side, per TICKET not per agent. */
  unread: boolean;
  /** Files on the ticket, oldest first. Fetched with the row, so the
   * inbox can show a paperclip count without opening it. */
  attachments: SupportAttachment[];
  can: SupportTicketPermissions;
}

/** One page of the inbox. */
export interface SupportTicketList {
  items: SupportTicket[];
  /** Tickets matching the query, not the page. */
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** `GET /support/tickets` query. No sort param — the route does not take
 * one; sending it is a 400. */
export interface SupportTicketListQuery {
  page?: number;
  limit?: number;
  /** Case-insensitive substring match on customer name, subject and
   * owner — nothing else. State has its own filter. */
  search?: string;
  state?: SupportTicketState;
}

export type SupportMessageKind = 'TENANT_REPLY' | 'INTERNAL_NOTE' | 'SYSTEM_EVENT' | 'CUSTOMER_MESSAGE' | 'PLATFORM_REPLY';

export interface SupportMessage {
  id: string;
  kind: SupportMessageKind;
  authorType: 'TENANT_USER' | 'CUSTOMER_USER' | 'PLATFORM_ADMIN' | 'SYSTEM';
  authorLabel: string;
  /** May be empty on a reply that was a document alone. */
  body: string;
  visibleToCustomer: boolean;
  /** Handed to the email bridge at this time — not proof of delivery. */
  emailDispatchedAt: string | null;
  createdAt: string;
  /** Also present in the ticket's own `attachments` — this is the only
   * place that can say "sent with THIS reply". */
  attachments: SupportAttachment[];
}

/** A ticket plus its full thread — `GET /support/tickets/:id`. */
export interface SupportTicketDetail extends Omit<SupportTicket, 'escalation'> {
  origin: string;
  agentId: string | null;
  runId: string | null;
  threadId: string | null;
  errorCode: string | null;
  deletedAt: string | null;
  /** Who the ticket goes back to when it returns from the platform team. */
  returnsTo: string | null;
  escalation:
    | (SupportEscalationView & {
        /** Exactly what crossed the boundary. Never carries customer identity. */
        sent: Record<string, unknown> | null;
      })
    | null;
  messages: SupportMessage[];
}

/** The four stat tiles. Cached 60s server-side. */
export interface SupportSummary {
  open: number;
  breachingSla: number;
  /** Open tickets whose NEXT reply is already late — a different clock
   * than `breachingSla`, which is the first-response verdict. */
  lateReplies: number;
  escalated: number;
  medianFirstResponseMins: number | null;
  /** "38m" | "4.2h" | "1.5d" | "—". */
  medianFirstResponseLabel: string;
  windowDays: number;
  total: number;
  /** This tenant's own first-response target. Null only before their
   * first ticket, when no policy row exists yet. */
  firstResponseTargetMins: number | null;
  /** "4 hours" | "90 minutes" | null. */
  firstResponseTargetLabel: string | null;
}

export interface SupportBusinessHours {
  /** IANA zone name. */
  timezone: string;
  /** ISO weekdays worked — 1 = Monday … 7 = Sunday. */
  days: number[];
  /** `HH:MM`, local to `timezone`. */
  start: string;
  end: string;
}

/** The workspace's SLA policy. `businessHours` null = a 24/7 clock. */
export interface SupportSlaPolicy {
  firstResponseMins: number;
  resolutionMins: number;
  atRiskPct: number;
  pauseWhenAnswered: boolean;
  businessHours: SupportBusinessHours | null;
  /** Non-null means a stored working week could not be parsed and the
   * clock is running 24/7 regardless. */
  businessHoursProblem: string | null;
  /** How long an agent-written reply is held before it is emailed, or
   * null (automatic replies OFF — every workspace's default). `0` is
   * legal and means "send on the next sweep", within about a minute. */
  autoReplyHoldMins: number | null;
  /** False when no row exists yet — the figures are schema defaults. */
  configured: boolean;
}

/* --- Requests ------------------------------------------------------------ */

/** A file about to be uploaded, as picked on-device (expo-document-picker /
 * expo-image-picker both resolve to this shape). Turned into a React
 * Native `FormData` part as `{ uri, name, type }`. */
export interface PickedFile {
  uri: string;
  name: string;
  /** MIME type, best guess from the picker. */
  type: string;
  sizeBytes: number;
}

export interface CreateSupportTicketRequest {
  subject: string;
  body?: string;
  /** Resolves the SLA policy at creation time — never re-evaluated later.
   * Omitted for NORMAL (the server's own default). */
  priority?: SupportPriority;
  /** Customer this is raised on behalf of. */
  customerId?: string;
  /** Tenant user id. Omit to leave unassigned. */
  assigneeId?: string;
  /** Creates and escalates in one transaction. */
  escalate?: boolean;
  files?: PickedFile[];
}

export interface SupportAttachmentUrl {
  url: string;
  fileName: string;
  mimeType: string;
}

export interface UpdateSupportTicketRequest {
  id: string;
  subject?: string;
  /** `null` unassigns. Omit to leave the owner alone. */
  assigneeId?: string | null;
  state?: SettableTicketState;
  priority?: SupportPriority;
  /** The `updatedAt` of the row this edit was composed against — sent on
   * every edit so a stale write is refused with 409 rather than
   * silently overwriting whoever won. */
  expectedUpdatedAt?: string;
}

export interface ReplyToSupportTicketRequest {
  id: string;
  /** Optional in the presence of `files` — a reply may be a document
   * with nothing to add. A request with neither is refused. */
  body?: string;
  files?: PickedFile[];
  /**
   * Deliberately never sent by this screen. Omit to let the server
   * decide (an OPEN ticket becomes ANSWERED) — a reply that also moved
   * the state would let an answer silently take back a ticket the
   * platform team are holding.
   */
  setState?: SettableTicketState;
}

/** No `files`, no `setState` — a note is never customer-facing and never
 * carries evidence of its own (evidence goes through the ticket's own
 * attachment list). */
export interface AddSupportTicketNoteRequest {
  id: string;
  body: string;
}

export interface SupportNoteResult {
  ticketId: string;
  messages: SupportMessage[];
}

/** A PUT, not a PATCH — a partial update to the numbers a clock is built
 * from would have an effect that depends on what happened to be stored. */
export interface UpdateSupportSlaPolicyRequest {
  firstResponseMins: number;
  resolutionMins: number;
  atRiskPct: number;
  pauseWhenAnswered: boolean;
  businessHours: SupportBusinessHours | null;
  autoReplyHoldMins: number | null;
}

export interface EscalateSupportTicketRequest {
  id: string;
  /** Context for the platform team. Never carries customer identity. */
  reason?: string;
}

/* --- Write results --------------------------------------------------------- */

export interface SupportReplyResult {
  messageId: string;
  ticketState: SupportTicketState;
  sla: { state: SupportSlaState; firstResponseMins: number | null };
  attachments: SupportAttachment[];
  email: {
    /** Handed to the bridge — not delivered. */
    dispatched: boolean;
    from: string | null;
    brandingApplied: boolean;
    reason?: string | null;
  };
}

export interface SupportEscalationResult {
  id: string;
  state: string;
  createdAt: string;
  ticketState: SupportTicketState;
  sent: Record<string, unknown>;
}

export interface SupportDeleteResult {
  id: string;
  deleted: boolean;
}

/* --- Auto-reply draft ------------------------------------------------------ */

/**
 * An agent-written reply waiting to go out, and the desk's chance to stop
 * it. Only the two live states ever reach a client — `GET
 * .../draft` answers `null` for SENT (an ordinary reply, read in the
 * thread), CANCELLED and FAILED (things that did not happen).
 */
export type SupportDraftState = 'PENDING' | 'HELD';

export interface SupportDraft {
  id: string;
  state: SupportDraftState;
  /** What the agent wrote. Null while PENDING — no answer yet. */
  body: string | null;
  /** ISO. When it goes, unless stopped first. Null while PENDING, same
   * reason as `body`: the hold window starts when the answer EXISTS. */
  sendAfter: string | null;
}

export interface SupportDraftCancelResult {
  id: string;
  state: string;
}
