/**
 * Chat domain types.
 *
 * Ported from the backend's own serialiser (`apps/b2b-chat/src/app/
 * serialisation/chat-view.ts`) rather than from the gateway's Swagger DTO
 * classes — the DTOs omit four keys the serialiser actually emits
 * (`purpose`, `knowledgeBaseId`, `pinned`, `pinnedAt`), so a client
 * generated from the OpenAPI document would be wrong. See
 * docs/chat-module-spec.md §1.
 *
 * The single most important rule in this file: MONEY IS OMITTED, NOT
 * ZEROED. For BUILDER and MEMBER the gateway leaves `totalCostCents`,
 * `totalTokens`, `promptTokens`, `costCents` etc. OUT of the JSON at every
 * nesting level — it does not send `0` and it does not send `null`. Those
 * fields are therefore optional here, and every read site must ask
 * "was this key present?", never "is this value truthy?". A rendered `0`
 * would be a false claim about spend to someone who is not allowed to
 * know it.
 */

/* -------------------------------------------------------------------------- */
/* Enums — mirrored from the Prisma schema                                    */
/* -------------------------------------------------------------------------- */

/** How a turn is produced. `AGENT` always carries an `agentId`. */
export type ChatMode = 'SOCKET' | 'AGENT';

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

/** Orthogonal to mode — a SUPPORT thread *is* an AGENT thread. There is a
 * partial unique index enforcing one live SUPPORT thread per customer. */
export type ConversationPurpose = 'GENERAL' | 'SUPPORT';

/** Attribution is a (type, id) PAIR. Sending one without the other is a 400. */
export type ChatOwnerType = 'CUSTOMER' | 'USER';

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

/** FAILED and CANCELLED are never charged — that is why they are distinct
 * terminal states rather than one "didn't work". */
export type MessageStatus = 'PENDING' | 'STREAMING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

export type AttachmentKind = 'FILE' | 'PHOTO' | 'VIDEO' | 'VOICE';

export type AttachmentStatus = 'PENDING' | 'READY' | 'FAILED';

/** Always `UNSCANNED` today — deliberately not `CLEAN`, which would claim a
 * scan happened. Renders as nothing at all, exactly as the web does. */
export type AttachmentScanVerdict = 'UNSCANNED' | 'PENDING' | 'CLEAN' | 'INFECTED' | 'REJECTED';

export type CitationSourceKind = 'KNOWLEDGE_BASE' | 'WEB' | 'ATTACHMENT';

/** The four different spend fixes, each a different screen to send the user
 * to. `null` means nothing is blocking. */
export type BalanceBlocker = 'TENANT' | 'CUSTOMER' | 'KEY' | 'WALLET';

/** Stable machine code on the conversation itself. Today the only value is
 * `AGENT_DELETED`; treat an unrecognised one as "blocked, reason unknown"
 * rather than as "not blocked". */
export type SendBlockedReason = 'AGENT_DELETED';

/* -------------------------------------------------------------------------- */
/* UI types                                                                    */
/* -------------------------------------------------------------------------- */

export interface ChatThread {
  id: string;
  /** May be an empty string — render through `threadDisplayName()`, never raw. */
  title: string;
  mode: ChatMode;
  purpose: ConversationPurpose;
  status: ConversationStatus;
  modelType: ChatOwnerType | null;
  modelId: string | null;
  /** Resolved display name for the attribution — a customer name, or a
   * user's name falling back to their email. */
  modelName: string | null;
  /** Derived server-side: equals `modelId` on a CUSTOMER thread, else null.
   * Read-only — attribution is changed through modelType/modelId. */
  customerId: string | null;
  projectId: string | null;
  projectName: string | null;
  knowledgeBaseId: string | null;
  agentId: string | null;
  agentVersion: number | null;
  /** Still resolved for a soft-deleted agent, which is what lets the
   * conversation say *which* agent went away. */
  agentName: string | null;
  agentDeleted: boolean;
  /** Bind the composer's enabled state to THIS FIELD, not to `agentDeleted`.
   * The backend may add reasons; re-deriving would miss them. */
  canSend: boolean;
  sendBlockedReason: SendBlockedReason | null;
  messageCount: number;
  lastMessagePreview: string | null;
  lastActivityAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  pinnedAt: string | null;

  /** Only ever present on `GET /conversations/:id` — never in the list. */
  retention?: ChatRetention;

  /* Absent (key not present) for BUILDER and MEMBER. */
  totalCostCents?: number;
  totalTokens?: number;
  /** Priced separately; never folded into `totalTokens`. */
  totalCachedTokens?: number;
}

export interface ChatRetention {
  /** 0 means keep indefinitely. (The web portal's own constant is named
   * `RETENTION_INDEFINITE` but its string reads "Delete after 90 days" —
   * a copy bug there. This app says "Keep indefinitely".) */
  deleteAfterDays: number;
  /** This thread's OWN purge date, stamped when it was opened — it can
   * differ from whatever the current policy would produce. */
  purgeAfterAt: string | null;
  /** Default false. Absent consent is not consent. */
  trainingAllowed: boolean;
}

export interface ChatThreadPage {
  items: ChatThread[];
  nextCursor: string | null;
  hasMore: boolean;
  /** How many threads match the filters — NOT the page size. */
  total: number;
}

export interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  transcript: string | null;
  status: AttachmentStatus;
  scanVerdict: AttachmentScanVerdict;
  createdAt: string;
}

export interface ChatCitation {
  id: string;
  sourceKind: CitationSourceKind;
  sourceId: string | null;
  sourceUrl: string | null;
  displayLabel: string;
  locatorPage: number | null;
  locator: string | null;
  relevanceScore: number | null;
  excerpt: string | null;
  ordinal: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  authorUserId: string | null;
  agentId: string | null;
  body: string;
  richContent: Record<string, unknown> | null;
  status: MessageStatus;
  /** Monotonic per conversation, allocated once and never reused. This is
   * what makes the keyset walk return every turn exactly once even while
   * new rows land at the head — order and de-duplicate on it. */
  sequence: number;
  replyToId: string | null;
  /** Visible to EVERY role — the model that answered is not a cost field. */
  modelSlug: string | null;
  providerServed: string | null;
  timeToFirstTokenMs: number | null;
  generationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  attachments: ChatAttachment[];
  citations: ChatCitation[];

  /* Absent for BUILDER and MEMBER. */
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  costCents?: number;

  /* ---- client-only fields, never sent by the server ---- */
  /** True while this row is the local echo of a send that has not been
   * acknowledged. Settled in place once the ack carries the real id. */
  isOptimistic?: boolean;
  /** Kept on the optimistic row so a resend can be recognised as a replay. */
  idempotencyKey?: string;
  /** Whether the server says another attempt could succeed. Read the ack's
   * own flag — do not keep a client-side table of retryable codes. */
  retryable?: boolean;
  /** Distinguishes "you stopped this" from "the money ran out mid-answer".
   * Absent on an explicit user cancel. */
  cancelReason?: 'user' | 'insufficient_balance';
}

export interface ChatMessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
  /** Note: messages have NO `total`, unlike conversations. */
  hasMore: boolean;
}

export interface ChatBalance {
  conversationId: string;
  /** False means billing did not answer. `canSend` is then TRUE — a billing
   * outage must not block the composer. */
  balanceKnown: boolean;
  canSend: boolean;
  blockedBy: BalanceBlocker | null;
  /** The server's own sentence. Prefer it over our per-blocker fallback. */
  message: string | null;
  /** Within 10% of a cap — a warning, never a block. */
  approaching: boolean;

  /* Absent for BUILDER and MEMBER. */
  currency?: string;
  balanceCents?: number;
  /** False means no wallet row exists yet; sends are still allowed. */
  walletProvisioned?: boolean;
  capRemainingCents?: number | null;
  estimate?: {
    perMessageCents: number;
    /** `nominal` = a 500-in/500-out guess at the fallback rate, i.e. this
     * thread has no observed turns to price from yet. */
    source: 'observed' | 'nominal';
    approxMessagesLeft: number | null;
    assumedTokens: { promptTokens: number; completionTokens: number } | null;
  };
  conversation?: {
    messageCount: number;
    pricedTurns: number;
    totalCostCents: number;
    totalTokens: number;
  };
}

export interface ChatModelOption {
  modelSlug: string;
  /** The tenant's alias when set, else the catalogue name. Always show
   * this, never the raw slug. */
  displayName: string;
  provider: string;
  allowed: boolean;
  blockedReason: 'HIDDEN_BY_TENANT_POLICY' | 'DEPRECATED' | null;
}

export interface ChatModels {
  conversationId: string;
  /** The per-thread override if one is set; else null on an AGENT thread
   * (read the model off the agent) or the workspace default on SOCKET. */
  selectedModelSlug: string | null;
  /** The WHOLE catalogue including blocked entries — that is what makes
   * "your allowlist permits 4 of 6" sayable. Blocked rows are disabled,
   * never hidden: a missing row reads as a loading fault. */
  items: ChatModelOption[];
  allowedCount: number;
  totalCount: number;
}

/**
 * A slim agent row for the "new thread" agent picker — the web fetches
 * this from `GET /agents/available` only while that dialog is open, rather
 * than reusing the full agents list, because usability (can this agent
 * take a new thread right now) is a different question from "does this
 * agent exist" and carries its own disabled reason per row.
 */
export interface AvailableAgent {
  id: string;
  name: string;
  status: 'DRAFT' | 'EVALUATED' | 'DEPLOYED' | 'ARCHIVED';
}

export interface ChatUploadIntent {
  attachmentId: string;
  /** This gateway's own endpoint, not a pre-signed provider PUT — bytes
   * stop at the gateway. */
  uploadPath: string;
  stagedUntil: string;
  maxBytes: number;
}

/** A signed URL that expires in ~120 seconds. Never cache it, never retry a
 * stale one — re-mint at the moment of use. */
export interface ChatAttachmentUrl {
  url: string;
  filename: string;
  mimeType: string;
  scanVerdict: AttachmentScanVerdict;
  expiresInSeconds: number;
}

/* -------------------------------------------------------------------------- */
/* Wire shapes — what the gateway actually returns/accepts                    */
/* -------------------------------------------------------------------------- */

/** The serialised conversation is already camelCase and already in the shape
 * the UI wants, so the "mapper" is a pass-through that exists to give the
 * boundary a name and a place to normalise if the contract drifts. */
export type ChatThreadWire = ChatThread;
export type ChatMessageWire = ChatMessage;

export interface ChatThreadPageWire {
  items: ChatThreadWire[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface ChatMessagePageWire {
  items: ChatMessageWire[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ChatThreadListParams {
  cursor?: string;
  /** 1..100, server default 30. */
  limit?: number;
  status?: ConversationStatus;
  /** Case-insensitive substring on the TITLE ONLY — not on transcripts. */
  search?: string;
  mode?: ChatMode;
  agentId?: string;
  /** The literal string `'none'` selects threads with no attribution. */
  modelId?: string;
  modelType?: ChatOwnerType;
  /** Must be sent as the STRING 'true' — the server coerces `=== 'true'`. */
  assignedToMe?: boolean;
  from?: string;
  to?: string;
}

export interface CreateThreadWire {
  title?: string;
  mode: ChatMode;
  agentId?: string;
  modelType?: ChatOwnerType;
  modelId?: string;
  projectId?: string;
  knowledgeBaseId?: string;
}

export interface SendMessageWire {
  body: string;
  idempotencyKey: string;
  richContent?: Record<string, unknown>;
  replyToId?: string;
  /** Max 10. Ids must be this tenant's, in this conversation, READY and not
   * already bound — otherwise the WHOLE send rolls back. */
  attachmentIds?: string[];
}

export interface SendMessageResultWire {
  message: ChatMessageWire;
  /** False means this was an idempotency-key replay: the original message
   * came back, no counters moved. Treat it as success. */
  created: boolean;
}

export interface BulkDeleteResultWire {
  deletedIds: string[];
  /** Ids the caller could not delete. Not an error — surface as a warning. */
  skippedIds: string[];
}

/* -------------------------------------------------------------------------- */
/* UI-facing input shapes                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateThreadInput {
  /** Blank is omitted from the request, never sent as ''. The first message
   * names the thread server-side. */
  title: string;
  agentId: string;
  knowledgeBaseId: string | null;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  idempotencyKey: string;
  attachmentIds?: string[];
}

/* -------------------------------------------------------------------------- */
/* UI row / composer types                                                     */
/* -------------------------------------------------------------------------- */

/** Threads are grouped by recency in the list, exactly as the web does.
 * Pinned is a group, not a sort key — the server does not order on it. */
export type ThreadGroupKey = 'pinned' | 'today' | 'week' | 'earlier';

export interface ThreadGroup {
  key: ThreadGroupKey;
  label: string;
  items: ChatThread[];
}

/** A turn the user has committed to but which cannot go out yet — the
 * previous answer is still streaming, or the composer is blocked. Parked
 * locally and released in order. */
export interface QueuedMessage {
  id: string;
  conversationId: string;
  body: string;
  attachmentIds: string[];
  state: 'waiting' | 'launching';
}

/** A file the user picked, tracked from selection through upload. The
 * upload starts at SELECTION, not at send, so the send itself only carries
 * ids. */
export interface ComposerAttachment {
  /** Local id — stable across the upload's state changes. */
  localId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  uri: string;
  state: 'uploading' | 'ready' | 'failed';
  /** 0..1, only meaningful while `uploading`. */
  progress: number;
  /** Present once the intent has reserved a row — needed to DELETE a
   * cancelled upload rather than leaving it for the 24h reaper. */
  attachmentId: string | null;
  error: string | null;
}

/** Why the composer is disabled, resolved in strict precedence order. See
 * `resolveComposerBlock` in chatRules.ts. */
export interface ComposerBlock {
  message: string;
  /** Transient blocks clear themselves (a rate limit); permanent ones need
   * the user or an owner to do something. */
  isTransient: boolean;
  /** Where the fix lives, when there is somewhere to send them. The web
   * names the destination in prose only; on a phone that should be a real
   * navigation target. */
  action: 'billing' | 'spendLimits' | null;
}
