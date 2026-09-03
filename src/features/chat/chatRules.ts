/**
 * Chat copy and pure helpers. No JSX, no hooks, no react-native imports —
 * everything here is testable in isolation, and every user-facing string in
 * the module lives here rather than inline in a screen.
 *
 * Copy is ported verbatim from the web portal's `Chat.data.ts` wherever the
 * behaviour is the same, so the two products say the same thing about the
 * same situation. Where this app deliberately diverges (see
 * docs/chat-module-spec.md §4) the divergence is commented at the constant.
 */

import type {
  BalanceBlocker,
  ChatBalance,
  ChatMessage,
  ChatRetention,
  ChatThread,
  ComposerBlock,
  MessageStatus,
  ThreadGroup,
  ThreadGroupKey,
} from './chat.types';

/* -------------------------------------------------------------------------- */
/* Limits — mirrored from the backend, not guessed                            */
/* -------------------------------------------------------------------------- */

/** `DEFAULT_CURSOR_LIMIT` server-side. The server caps at 100. */
export const THREADS_PAGE_SIZE = 30;
export const MESSAGES_PAGE_SIZE = 30;

/** `ArrayMaxSize(10)` on the REST DTO and hard-checked in the socket handler. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/** `DEFAULT_MAX_ATTACHMENT_BYTES` = 25 MiB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** `SendMessageBodyDto.body` is `@Length(1, 32000)`. */
export const MAX_MESSAGE_LENGTH = 32000;

/** `UpdateConversationBodyDto.title` is `@Length(1, 200)`. */
export const MAX_THREAD_TITLE_LENGTH = 200;

/** `ArrayMaxSize(100)` on bulk-delete. */
export const MAX_BULK_DELETE_IDS = 100;

export const SEARCH_DEBOUNCE_MS = 300;

/** Matches the web: stop broadcasting after this much keyboard silence. The
 * server's typing key has a 5s TTL, so this must stay comfortably under it. */
export const TYPING_IDLE_MS = 2200;

/** A rate-limit block lifts itself rather than stranding the composer. */
export const RATE_LIMIT_COOLDOWN_MS = 15000;

/**
 * A turn's live frames (`message:pending`/`:delta`/`:complete`/`:failed`) go
 * ONLY to the socket that sent it when it was sent over the socket, and to
 * the whole conversation room when it was sent over HTTP (no socket to
 * scope to) — confirmed against the gateway's own routing comment
 * (`chat.gateway.ts`'s `route()`). Either way, a device that was not
 * actually connected and joined at the moment those frames were emitted
 * never receives them and has no way to learn the turn finished short of
 * asking. `GET /messages/:id` is that ask. Widening intervals rather than a
 * fixed tick, ported from the web's own recovery poller: a turn recovered
 * after a reconnect is usually already done — the first read settles it —
 * and the ones that are not are mid-generation, where a second of latency
 * costs nothing. Gives up after roughly two minutes, longer than any turn
 * this backend produces.
 */
export const RECOVERY_DELAYS_MS: readonly number[] = [
  400, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000,
];

/** A turn nothing further will happen to — the recovery poller stops here. */
export const RECOVERY_TERMINAL_STATUSES: ReadonlySet<MessageStatus> = new Set([
  'COMPLETE',
  'FAILED',
  'CANCELLED',
]);

/** How long after another party's `message:created` to look for its answer.
 * The assistant row is written before its first delta, so a short wait is
 * enough for it to exist; the recovery poller covers it from there.
 * Debounced, so a burst of traffic is one refetch rather than one per
 * message. */
export const FOREIGN_TURN_CATCHUP_DELAY_MS = 1500;

/** Coalesces repeated thread-list/balance invalidations from a fast-moving
 * stream into one, matching the web's own debounce on the same signal. */
export const THREAD_LIST_REFRESH_DEBOUNCE_MS = 900;

/* -------------------------------------------------------------------------- */
/* Page copy                                                                   */
/* -------------------------------------------------------------------------- */

export const CHAT_DESCRIPTION =
  'Talk to your agents. Threads run against your own agents, with cost visible to Owner, Admin and Finance.';

export const UNTITLED_THREAD = 'Untitled thread';
export const UNNAMED_AGENT = 'Agent';
/** A thread with no customer/user attribution. */
export const UNATTRIBUTED_LABEL = 'Internal';
/** Used when the socket reports a typing actor with no display name. */
export const SOMEONE_LABEL = 'Someone';

export const NO_THREADS_TITLE = 'No threads yet';
export const NO_THREADS_BODY = 'Start a thread to talk to one of your agents.';
export const NO_THREADS_BODY_READ_ONLY = 'Nobody has started a conversation in this workspace yet.';

export const NO_ARCHIVED_TITLE = 'No archived threads';
export const NO_ARCHIVED_BODY = 'Threads you archive will show up here.';

export const NO_MESSAGES_TITLE = 'No messages yet';
export const NO_MESSAGES_BODY =
  'Ask a question and the agent will answer from the knowledge bases it has been given, citing the document it drew on.';

export const SEARCH_PLACEHOLDER = 'Search threads';
export const SEARCH_EMPTY_TITLE = 'No threads found';
/** Worth being explicit: the server matches the TITLE only, so "I know I
 * said that" is a legitimate reason for a miss. */
export const SEARCH_EMPTY_BODY = 'This matches the thread name only — try a different word.';

export const THREADS_ERROR_TITLE = 'Could not load threads';
export const TRANSCRIPT_ERROR_TITLE = 'Could not load this transcript';

export const NO_ACCESS_TITLE = 'You cannot view chat';
export const NO_ACCESS_BODY =
  'Reading threads and transcripts needs the "View chat" permission. Ask an owner or an admin to grant it.';

/* -------------------------------------------------------------------------- */
/* Action copy                                                                 */
/* -------------------------------------------------------------------------- */

export const NO_PERMISSION_MESSAGE = {
  manage: 'Your role cannot change threads.',
  send: 'Your role can read this conversation but not post to it.',
} as const;

export const THREAD_ACTION_COPY = {
  pin: { done: (n: string) => `"${n}" pinned.`, failed: 'Could not update that pin.' },
  unpin: { done: (n: string) => `"${n}" unpinned.`, failed: 'Could not update that pin.' },
  archive: {
    done: (n: string) => `"${n}" archived.`,
    failed: "Could not update that thread's archive state.",
  },
  unarchive: {
    done: (n: string) => `"${n}" restored from archive.`,
    failed: "Could not update that thread's archive state.",
  },
  rename: { done: (n: string) => `Renamed to "${n}"`, failed: 'Could not save that thread.' },
  create: { done: (n: string) => `Thread "${n}" created.`, failed: 'Could not save that thread.' },
} as const;

export const DELETE_THREAD_COPY = {
  title: (count: number) => (count === 1 ? 'Delete thread?' : `Delete ${count} threads?`),
  body: (count: number, name: string) =>
    count === 1
      ? `"${name}" and its transcript will be removed. This cannot be undone.`
      : `${count} threads and their transcripts will be removed. This cannot be undone.`,
  done: (count: number) => (count === 1 ? 'Thread deleted.' : `${count} threads deleted.`),
  failed: (count: number) =>
    count === 1 ? 'Could not delete that thread.' : 'Could not delete the selected threads.',
  /** Partial success is a warning, not an error — some rows went. */
  skipped: (count: number) =>
    count === 1
      ? '1 thread could not be deleted — it may no longer be yours to remove.'
      : `${count} threads could not be deleted — they may no longer be yours to remove.`,
} as const;

/* -------------------------------------------------------------------------- */
/* Send / streaming copy                                                       */
/* -------------------------------------------------------------------------- */

export const SEND_FAILED_NOTE = 'That message could not be sent.';
export const SEND_TIMED_OUT_NOTE =
  'The chat service did not acknowledge that message. It was not sent.';
export const PAYMENT_REQUIRED_NOTE =
  'That message was not sent: your free allowance and wallet are both empty, or a spend cap would be exceeded. The allowance returns tomorrow — or top up in Billing & pricing, or raise the cap.';
export const RATE_LIMITED_NOTE =
  'Sending too quickly — the chat service is rate limiting this connection. Wait a moment and try again.';
export const NOT_RETRYABLE_NOTE = 'The server says retrying this turn will not help.';
export const CANCEL_UNAVAILABLE_HINT = 'Cancelling needs the live connection, and it is down.';
export const CANCELLED_LABEL = 'Cancelled';
export const CANCELLED_NO_BALANCE_LABEL =
  'Stopped — the spend limit or wallet balance ran out partway through.';
export const DRAFTING_LABEL = 'Drafting a follow-up…';
export const LOADING_TRANSCRIPT_LABEL = 'Loading conversation…';
export const LOAD_EARLIER_LABEL = 'Load earlier messages';
export const NEW_MESSAGES_LABEL = 'New messages';

export const SOCKET_RECOVERING_NOTE = 'Reconnecting to the chat service…';
export const SOCKET_DOWN_TITLE = 'Not connected';
/** Note what this does NOT say: it does not say you cannot send. The HTTP
 * fallback still works while the socket is down — what is lost is the
 * stream, and being disconnected is deliberately not a composer block. */
export const SOCKET_DOWN_NOTE = 'Live updates are paused. Messages still send, but replies will not stream in.';

export const APPROACHING_CAP_NOTE = 'This conversation is within 10% of a spend cap.';
export const REAUTH_SOON_NOTE =
  'Your session is about to expire. Sign in again to keep this conversation live.';

/**
 * Error codes the backend uses for a refusal that repeating will not fix —
 * a guardrail, a cap, a policy. Rendered as a calm amber note with NO retry
 * button, because offering Retry on a blocked turn just gets it blocked
 * again.
 */
export const POLICY_ERROR_CODES: readonly string[] = [
  'GUARDRAIL_BLOCKED',
  'GUARDRAIL',
  'CONTENT_BLOCKED',
  'LIMIT_EXCEEDED',
  'RATE_LIMITED',
  'PAYMENT_REQUIRED',
  'SPEND_CAP_EXCEEDED',
];

export function isPolicyBlock(message: ChatMessage): boolean {
  return message.errorCode !== null && POLICY_ERROR_CODES.includes(message.errorCode);
}

/* -------------------------------------------------------------------------- */
/* Composer blocking                                                           */
/* -------------------------------------------------------------------------- */

/** One sentence per blocker, because the four are four different fixes on
 * four different screens. The server usually sends its own sentence and
 * that wins — these are the fallback. */
export const BLOCKED_BY_NOTE: Record<BalanceBlocker, string> = {
  TENANT: 'Your workspace has reached its spend cap. Raise it in Spend limits.',
  CUSTOMER: 'The customer this thread is filed under has reached their spend cap.',
  KEY: 'The API key serving this thread has reached its own limit.',
  WALLET:
    'The wallet is empty and your daily free allowance is spent. It returns tomorrow — or top up in Billing & pricing to keep going now.',
};

export const BLOCK_NO_BALANCE_FALLBACK = 'This conversation has reached its spend limit.';
export const BLOCK_AGENT_DELETED =
  'The agent behind this thread has been deleted, so it can no longer answer.';
export const BLOCK_SEND_UNAVAILABLE = 'This thread cannot take new messages.';

const BLOCKER_ACTION: Record<BalanceBlocker, ComposerBlock['action']> = {
  TENANT: 'spendLimits',
  CUSTOMER: 'spendLimits',
  KEY: null,
  WALLET: 'billing',
};

/**
 * Resolves why the composer is disabled, in STRICT precedence order. The
 * order is the point: a user with no send permission should be told that,
 * not told the wallet is empty, and a rate limit should not be reported as
 * a spend cap.
 *
 * Two deliberate non-blocks, both matching the web:
 *  - being disconnected is NOT a block (the HTTP fallback still sends);
 *  - `balanceKnown: false` is NOT a block (billing being down must not stop
 *    people working — the atomic reservation inside the turn is the real
 *    enforcement anyway).
 */
export function resolveComposerBlock(args: {
  thread: ChatThread | undefined;
  canSend: boolean;
  rateLimitedUntil: number | null;
  balance: ChatBalance | undefined;
  now?: number;
}): ComposerBlock | null {
  const { thread, canSend, rateLimitedUntil, balance } = args;
  const now = args.now ?? Date.now();

  if (!thread) return { message: 'Pick a thread to start writing.', isTransient: false, action: null };

  if (!canSend) return { message: NO_PERMISSION_MESSAGE.send, isTransient: false, action: null };

  // The conversation's own gate — today only a deleted agent, but read the
  // field rather than re-deriving so a new server reason still blocks.
  if (!thread.canSend) {
    return {
      message: thread.sendBlockedReason === 'AGENT_DELETED' ? BLOCK_AGENT_DELETED : BLOCK_SEND_UNAVAILABLE,
      isTransient: false,
      action: null,
    };
  }

  if (rateLimitedUntil !== null && rateLimitedUntil > now) {
    return { message: RATE_LIMITED_NOTE, isTransient: true, action: null };
  }

  if (balance && !balance.canSend) {
    const fallback = balance.blockedBy ? BLOCKED_BY_NOTE[balance.blockedBy] : BLOCK_NO_BALANCE_FALLBACK;
    return {
      message: balance.message ?? fallback,
      isTransient: false,
      action: balance.blockedBy ? BLOCKER_ACTION[balance.blockedBy] : null,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                             */
/* -------------------------------------------------------------------------- */

/** A thread can legitimately have an empty title until its first message
 * names it server-side. Never write this placeholder back to the server. */
export function threadDisplayName(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNTITLED_THREAD;
}

export function agentDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNNAMED_AGENT;
}

/** Money is OMITTED for roles that may not see it, so presence of the key —
 * not truthiness — is the test. `0` is a real, meaningful value. */
export function hasCost(thread: Pick<ChatThread, 'totalCostCents'>): boolean {
  return typeof thread.totalCostCents === 'number';
}

export function messageHasCost(message: Pick<ChatMessage, 'costCents'>): boolean {
  return typeof message.costCents === 'number';
}

/* -------------------------------------------------------------------------- */
/* Retention                                                                   */
/* -------------------------------------------------------------------------- */

/** `0` means keep indefinitely. The web's own constant is misnamed (see
 * docs/chat-module-spec.md §6.4) — this app says what it means. */
export function formatRetentionPolicy(retention: Pick<ChatRetention, 'deleteAfterDays'>): string {
  return retention.deleteAfterDays === 0 ? 'Keep indefinitely' : `Delete after ${retention.deleteAfterDays} days`;
}

/** The thread's OWN stamped purge date — can differ from what the current
 * policy would produce if the policy changed after this thread was opened. */
export function formatPurgeDate(retention: Pick<ChatRetention, 'purgeAfterAt'>): string {
  if (!retention.purgeAfterAt) return 'Not scheduled';
  const d = new Date(retention.purgeAfterAt);
  if (Number.isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                    */
/* -------------------------------------------------------------------------- */

const GROUP_LABELS: Record<ThreadGroupKey, string> = {
  pinned: 'Pinned',
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Groups threads the way the web does: Pinned / Today / This week / Earlier.
 *
 * Pinning is a GROUP here, not a sort key, and it has to be applied on the
 * client — the server keysets on `(lastActivityAt, id)` and does not order
 * on `pinned` at all. An empty group is dropped entirely rather than
 * rendered as a heading over nothing, which would read as a claim that
 * there is something there.
 */
export function groupThreads(threads: readonly ChatThread[], now = Date.now()): ThreadGroup[] {
  const todayStart = startOfToday(now);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const buckets: Record<ThreadGroupKey, ChatThread[]> = {
    pinned: [],
    today: [],
    week: [],
    earlier: [],
  };

  for (const thread of threads) {
    if (thread.pinned) {
      buckets.pinned.push(thread);
      continue;
    }
    const activity = Date.parse(thread.lastActivityAt);
    if (Number.isNaN(activity) || activity < weekStart) buckets.earlier.push(thread);
    else if (activity >= todayStart) buckets.today.push(thread);
    else buckets.week.push(thread);
  }

  const order: ThreadGroupKey[] = ['pinned', 'today', 'week', 'earlier'];
  return order
    .filter((key) => (buckets[key]?.length ?? 0) > 0)
    .map((key) => ({ key, label: GROUP_LABELS[key], items: buckets[key] ?? [] }));
}

/* -------------------------------------------------------------------------- */
/* Attachments                                                                 */
/* -------------------------------------------------------------------------- */

/** `ALLOWED_EXTENSIONS_BY_KIND` in the backend's attachments lib. Anything
 * outside these is refused server-side after the bytes have been uploaded,
 * so it is worth refusing locally first. */
export const ALLOWED_EXTENSIONS = {
  FILE: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'md', 'json', 'zip'],
  PHOTO: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  VIDEO: ['mp4', 'webm', 'mov'],
  VOICE: ['webm', 'ogg', 'mp3', 'm4a', 'wav'],
} as const;

export const ATTACHMENT_TOO_LARGE = (filename: string) =>
  `"${filename}" is larger than the 25 MB limit and was not attached.`;
export const ATTACHMENT_LIMIT_REACHED =
  'A message can carry ten attachments. The extras were not attached.';
export const ATTACHMENT_UPLOAD_FAILED = 'Upload failed.';
export const ATTACHMENT_OPEN_FAILED = 'Could not open that attachment.';

/** Kind is what decides the allowed extension list server-side, so it has to
 * be right at intent time — a `.webm` is a VOICE or a VIDEO depending on
 * what the picker was asked for, and the backend uses the hint to resolve
 * the sniffed type. */
export function attachmentKindFor(mimeType: string): 'FILE' | 'PHOTO' | 'VIDEO' {
  if (mimeType.startsWith('image/')) return 'PHOTO';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `m:ss`, for voice notes and video durations. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
