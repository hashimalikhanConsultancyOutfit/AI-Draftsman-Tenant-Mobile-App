import { api } from '@/store/api';
import {
  noteOwnReply,
  noteOwnTurn,
  onChatLocalEvent,
  onChatSocketEvent,
  onChatSocketStatus,
  ownsTurn,
  requestResync,
  type CancelledFrame,
  type CompleteFrame,
  type DeltaFrame,
  type FailedFrame,
} from '@/services/chatSocket';

import type {
  AvailableAgent,
  BulkDeleteResultWire,
  ChatBalance,
  ChatMessage,
  ChatMessagePage,
  ChatMessagePageWire,
  ChatModels,
  ChatThread,
  ChatThreadListParams,
  ChatThreadPage,
  ChatThreadPageWire,
  ChatUploadIntent,
  ChatAttachmentUrl,
  CreateThreadInput,
  CreateThreadWire,
  SendMessageInput,
  SendMessageResultWire,
} from './chat.types';
import {
  FOREIGN_TURN_CATCHUP_DELAY_MS,
  MESSAGES_PAGE_SIZE,
  RECOVERY_DELAYS_MS,
  RECOVERY_TERMINAL_STATUSES,
  THREADS_PAGE_SIZE,
  THREAD_LIST_REFRESH_DEBOUNCE_MS,
} from './chatRules';

/**
 * Chat endpoints.
 *
 * Two things here differ from the other feature api files, both on purpose.
 *
 * 1. **Cursor pagination, not page/limit.** Chat and audit are the only
 *    modules on this convention. `hasMore`/`nextCursor` is the ONLY correct
 *    "is there more" signal — never infer it from row count, because a
 *    filtered page can be short and still have more behind it.
 *
 * 2. **`getMessages` keeps one cache entry per conversation and merges
 *    pages into it**, rather than the append-in-the-screen idiom the other
 *    list screens use. A transcript is written to by the socket as well as
 *    by paging — deltas, completions, failures and cancellations all patch
 *    rows in place — and there has to be exactly one place that holds them.
 *    Local screen state would fork the moment a second frame arrived.
 *
 * ── WHY THIS FILE ALSO POLLS `GET /messages/:id` ────────────────────────────
 * A turn's live frames go only to the socket that sent it when it was sent
 * over the socket, and to the whole conversation room when it was sent over
 * HTTP (chat.gateway.ts's `route()` — no `origin` on the frame means the
 * conversation-room routing it has always had). Either way, a device that
 * was not actually connected AND joined to the room at the moment those
 * frames were emitted never receives them — a dropped connection, a
 * reconnect that gets a new socket id and inherits none of the old one's
 * subscriptions, or simply opening the conversation after the turn already
 * started. The assistant row is persisted before its first delta, so it is
 * always recoverable by asking for it directly. This is ported line-for-line
 * in spirit from the web's `messages.api.ts` `recoverStalledTurns`.
 */

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

/* The gateway's serialiser already emits camelCase in the shape the UI
   wants, so these are pass-throughs. They exist so the boundary has a name:
   if the contract drifts, it drifts in one place. Note especially that the
   money keys must be COPIED BY SPREAD, never re-listed field by field —
   listing them would turn an absent key into `undefined`, which reads as
   "zero" at a lot of call sites. */
function toThreadPage(wire: ChatThreadPageWire): ChatThreadPage {
  return { items: wire.items, nextCursor: wire.nextCursor, hasMore: wire.hasMore, total: wire.total };
}

function toMessagePage(wire: ChatMessagePageWire): ChatMessagePage {
  return { items: wire.items, nextCursor: wire.nextCursor, hasMore: wire.hasMore };
}

function listQuery(params: ChatThreadListParams): Record<string, string | number> {
  const query: Record<string, string | number> = { limit: params.limit ?? THREADS_PAGE_SIZE };
  if (params.cursor) query.cursor = params.cursor;
  if (params.status) query.status = params.status;
  if (params.search) query.search = params.search;
  if (params.mode) query.mode = params.mode;
  if (params.agentId) query.agentId = params.agentId;
  if (params.modelId) query.modelId = params.modelId;
  if (params.modelType) query.modelType = params.modelType;
  // The server coerces `value === true || value === 'true'`, and our query
  // serialiser stringifies — send the string form explicitly so the intent
  // is visible here rather than depending on that coercion.
  if (params.assignedToMe) query.assignedToMe = 'true';
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  return query;
}

function toCreateBody(input: CreateThreadInput): CreateThreadWire {
  const body: CreateThreadWire = { mode: 'AGENT', agentId: input.agentId };
  // A blank title is OMITTED, not sent as ''. The server names the thread
  // from its first message; sending '' would pin it to an empty name.
  const title = input.title.trim();
  if (title.length > 0) body.title = title;
  if (input.knowledgeBaseId) body.knowledgeBaseId = input.knowledgeBaseId;
  return body;
}

/* -------------------------------------------------------------------------- */
/* Cache-patch helpers used by the socket subscription                         */
/* -------------------------------------------------------------------------- */

/** Messages arrive newest-first (`sequence` desc) and are rendered into an
 * inverted list, so index 0 is the newest turn. Finding a row by id is a
 * linear scan of at most a few pages. */
function findIndexById(items: readonly ChatMessage[], messageId: string): number {
  return items.findIndex((m) => m.id === messageId);
}

/**
 * Merge a server message into the transcript, replacing any optimistic
 * stand-in. Two matches, in order of how much they can be trusted:
 *
 *  1. Same id — the ordinary case, including a `message:created` echo of a
 *     turn this device already reconciled through its own send ack.
 *  2. An optimistic USER turn this device is still waiting to reconcile,
 *     matched on idempotency key. This is what lets a recovered/resumed
 *     row replace the local placeholder instead of appearing as a second
 *     bubble next to it.
 *
 * Newest-first order (this app's convention, unlike the web's ascending
 * transcript) is preserved by inserting at the position `sequence` implies
 * rather than always at the head.
 */
function insertBySequenceDesc(items: ChatMessage[], message: ChatMessage): void {
  let index = items.length;
  while (index > 0) {
    const previous = items[index - 1];
    if (!previous || previous.sequence >= message.sequence) break;
    index -= 1;
  }
  items.splice(index, 0, message);
}

function upsertMessage(items: ChatMessage[], incoming: ChatMessage): void {
  const byId = findIndexById(items, incoming.id);
  if (byId !== -1) {
    items[byId] = { ...items[byId], ...incoming, isOptimistic: false };
    return;
  }

  const optimistic = items.findIndex(
    (item) =>
      item.isOptimistic === true &&
      incoming.idempotencyKey !== undefined &&
      item.idempotencyKey === incoming.idempotencyKey,
  );
  if (optimistic !== -1) items.splice(optimistic, 1);

  insertBySequenceDesc(items, { ...incoming, isOptimistic: false });
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /* ---------------------------------------------------------------- */
    /* Threads                                                           */
    /* ---------------------------------------------------------------- */

    getChatThreads: builder.query<ChatThreadPage, ChatThreadListParams>({
      query: (params) => ({ url: '/conversations', query: listQuery(params) }),
      transformResponse: (wire: ChatThreadPageWire) => toThreadPage(wire),
      providesTags: (result) => [
        ...(result?.items ?? []).map((t) => ({ type: 'ChatThread' as const, id: t.id })),
        { type: 'ChatThread' as const, id: 'LIST' },
      ],
    }),

    /** The only call that returns `retention` — the list omits it. */
    getChatThread: builder.query<ChatThread, string>({
      query: (id) => ({ url: `/conversations/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'ChatThread', id }],
    }),

    createChatThread: builder.mutation<ChatThread, CreateThreadInput>({
      query: (input) => ({ url: '/conversations', method: 'POST', body: toCreateBody(input) }),
      invalidatesTags: [{ type: 'ChatThread', id: 'LIST' }],
    }),

    /** Rename and archive/unarchive both land here. `DELETED` is rejected by
     * the server — deletion goes through bulk-delete. */
    updateChatThread: builder.mutation<
      ChatThread,
      { id: string; title?: string; status?: 'ACTIVE' | 'ARCHIVED' }
    >({
      query: ({ id, ...body }) => ({ url: `/conversations/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ChatThread', id }, { type: 'ChatThread', id: 'LIST' }],
    }),

    pinChatThread: builder.mutation<ChatThread, { id: string; pinned: boolean }>({
      query: ({ id, pinned }) => ({ url: `/conversations/${id}/pin`, method: 'POST', body: { pinned } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ChatThread', id }, { type: 'ChatThread', id: 'LIST' }],
    }),

    /** An empty string is normalised to `null` server-side, which is how a
     * knowledge base is cleared. */
    setChatThreadKnowledgeBase: builder.mutation<ChatThread, { id: string; knowledgeBaseId: string }>({
      query: ({ id, knowledgeBaseId }) => ({
        url: `/conversations/${id}/knowledge-base`,
        method: 'PATCH',
        body: { knowledgeBaseId },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ChatThread', id }, { type: 'ChatThread', id: 'LIST' }],
    }),

    /** One endpoint for one thread and for many — the single-thread DELETE
     * route exists but the web never uses it, and a one-item batch keeps the
     * partial-failure reporting identical in both cases. */
    deleteChatThreads: builder.mutation<BulkDeleteResultWire, string[]>({
      query: (ids) => ({ url: '/conversations/bulk-delete', method: 'POST', body: { ids } }),
      invalidatesTags: [{ type: 'ChatThread', id: 'LIST' }],
    }),

    /**
     * The new-thread agent picker's own source — deliberately not the full
     * `getAgents` list from company-agents, because usability (can this
     * agent take a new conversation right now) is a different question
     * from "does this agent exist", and the web only ever fetches this
     * while that one dialog is open.
     */
    getAvailableAgentsForChat: builder.query<AvailableAgent[], void>({
      query: () => ({ url: '/agents/available' }),
    }),

    /* ---------------------------------------------------------------- */
    /* Balance and models                                                */
    /* ---------------------------------------------------------------- */

    /** Read this to explain a blocked composer. It is a READ, not a
     * reservation — two devices can both be told yes, and the atomic
     * reservation inside the turn is what actually decides. */
    getChatBalance: builder.query<ChatBalance, string>({
      query: (conversationId) => ({ url: `/conversations/${conversationId}/balance` }),
      providesTags: (_r, _e, id) => [{ type: 'ChatBalance', id }],
    }),

    getChatModels: builder.query<ChatModels, string>({
      query: (conversationId) => ({ url: `/conversations/${conversationId}/models` }),
      providesTags: (_r, _e, id) => [{ type: 'ChatModels', id }],
    }),

    /** Forward-only: this never rewrites the `modelSlug` recorded on a turn
     * that has already been answered. */
    setChatThreadModel: builder.mutation<ChatModels, { conversationId: string; modelSlug: string }>({
      query: ({ conversationId, modelSlug }) => ({
        url: `/conversations/${conversationId}/model`,
        method: 'PATCH',
        body: { modelSlug },
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [
        { type: 'ChatModels', id: conversationId },
        { type: 'ChatThread', id: conversationId },
      ],
    }),

    /* ---------------------------------------------------------------- */
    /* Messages                                                          */
    /* ---------------------------------------------------------------- */

    getChatMessages: builder.query<ChatMessagePage, { conversationId: string; cursor?: string }>({
      query: ({ conversationId, cursor }) => ({
        url: `/conversations/${conversationId}/messages`,
        query: cursor ? { limit: MESSAGES_PAGE_SIZE, cursor } : { limit: MESSAGES_PAGE_SIZE },
      }),
      transformResponse: (wire: ChatMessagePageWire) => toMessagePage(wire),

      // One cache entry per conversation, keyed without the cursor, so
      // paging older turns extends the transcript the socket is writing to
      // rather than replacing it.
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}(${queryArgs.conversationId})`,

      merge: (cache, incoming, { arg }) => {
        if (!arg.cursor) {
          // A fresh load or a refetch: the server is authoritative for the
          // head of the transcript. Anything optimistic that is still
          // outstanding would have been settled or failed by now.
          cache.items = incoming.items;
          cache.nextCursor = incoming.nextCursor;
          cache.hasMore = incoming.hasMore;
          return;
        }
        // An older page. Rows come back newest-first, so older turns belong
        // at the TAIL. De-duplicate by id: a resume and a page fetch can
        // legitimately overlap.
        const seen = new Set(cache.items.map((m) => m.id));
        cache.items.push(...incoming.items.filter((m) => !seen.has(m.id)));
        cache.nextCursor = incoming.nextCursor;
        cache.hasMore = incoming.hasMore;
      },

      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,

      providesTags: (_r, _e, { conversationId }) => [{ type: 'ChatMessage', id: conversationId }],

      /**
       * The streaming subscription, and the turn-recovery sweep. Lives here
       * rather than in a screen because the cache entry is the only copy of
       * the transcript: a component that unmounted mid-answer must not take
       * the rest of the reply with it, and a device that was never in the
       * room for a turn still needs a way to learn it happened.
       */
      async onCacheEntryAdded(
        { conversationId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch, getCacheEntry },
      ) {
        /** Next expected `chunkIndex` per streaming message THIS device is
         * actively receiving deltas for. A message id is added here only
         * when its `message:pending`/`:created` placeholder was inserted,
         * and removed the moment it stops streaming (terminal frame, gap
         * detected, or the connection drops) — its presence is exactly the
         * "is a live stream feeding this row right now" signal the
         * recovery sweep below reads. */
        const nextChunk = new Map<string, number>();

        /** Recoveries in flight, so two triggers do not poll the same row
         * twice concurrently. */
        const recovering = new Set<string>();
        /** Every timer this entry owns, cleared together on teardown. */
        const timers = new Set<ReturnType<typeof setTimeout>>();
        let listRefreshTimer: ReturnType<typeof setTimeout> | null = null;
        let foreignTurnTimer: ReturnType<typeof setTimeout> | null = null;

        const later = (fn: () => void, ms: number) => {
          const timer = setTimeout(() => {
            timers.delete(timer);
            fn();
          }, ms);
          timers.add(timer);
          return timer;
        };

        /** Thread-list freshness: `lastMessagePreview`, `messageCount` and
         * cost totals live on the thread row, not this cache entry, so a
         * completed turn has to say so separately. Debounced — a streaming
         * answer must not invalidate the list once per token. */
        const refreshThreadList = () => {
          if (listRefreshTimer) clearTimeout(listRefreshTimer);
          listRefreshTimer = setTimeout(() => {
            dispatch(
              chatApi.util.invalidateTags([
                { type: 'ChatThread', id: 'LIST' },
                { type: 'ChatBalance', id: conversationId },
              ]),
            );
          }, THREAD_LIST_REFRESH_DEBOUNCE_MS);
        };

        /**
         * Poll one message until it stops being STREAMING (or PENDING).
         * `GET /messages/:id` rather than a transcript refetch: the row is
         * already in the cache, it is one row that changed, and a full
         * refetch per stalled turn would fight the pagination the user is
         * scrolled into. A delta arriving mid-poll ends it — `nextChunk`
         * gaining the id means frames are flowing again, and the push
         * always beats the pull.
         */
        const recoverMessage = (messageId: string, attempt = 0) => {
          if (attempt === 0) {
            if (recovering.has(messageId)) return;
            recovering.add(messageId);
          }

          const delay = RECOVERY_DELAYS_MS[attempt];
          if (delay === undefined) {
            // Out of attempts. The row keeps whatever the last read said.
            recovering.delete(messageId);
            return;
          }

          later(() => {
            if (nextChunk.has(messageId)) {
              // A live stream picked this row back up — the poll is moot.
              recovering.delete(messageId);
              return;
            }

            // `subscribe: false`: a poll is a read, not an interest — a
            // subscribing dispatch would leave a permanent extra
            // subscriber on this message per attempt.
            dispatch(chatApi.endpoints.getChatMessage.initiate(messageId, { subscribe: false, forceRefetch: true }))
              .unwrap()
              .then((message) => {
                updateCachedData((draft) => {
                  upsertMessage(draft.items, message);
                });
                if (RECOVERY_TERMINAL_STATUSES.has(message.status)) {
                  recovering.delete(messageId);
                  noteSequence(message.sequence);
                  refreshThreadList();
                  return;
                }
                recoverMessage(messageId, attempt + 1);
              })
              .catch(() => {
                // A read that failed is not an answer either way — keep the
                // schedule rather than declaring the turn dead.
                recoverMessage(messageId, attempt + 1);
              });
          }, delay);
        };

        /** Find every row that is stuck and start pulling it. A row
         * qualifies when it is still PENDING/STREAMING and no delta stream
         * is actually feeding it right now — covering both a turn this
         * device orphaned by reconnecting AND a turn it was never in the
         * room to receive frames for in the first place. */
        const recoverStalledTurns = () => {
          const items = getCacheEntry().data?.items ?? [];
          items.forEach((message) => {
            if (
              (message.status === 'STREAMING' || message.status === 'PENDING') &&
              !nextChunk.has(message.id)
            ) {
              recoverMessage(message.id);
            }
          });
        };

        const noteSequence = (sequence: number) => {
          void sequence; // Reserved for a future read-receipt optimisation.
        };

        /** Someone else's turn (another device signed in as this user, or
         * a teammate sharing the thread) arrived as `message:created`. Its
         * answer streams to THEM — or, if it was sent over HTTP, broadcasts
         * to whoever happens to be in the room at the right moment, which
         * this device may have missed by a beat. Either way, go and find
         * the answer rather than leaving the question sitting on its own. */
        const scheduleForeignTurnCatchUp = () => {
          if (foreignTurnTimer) clearTimeout(foreignTurnTimer);
          foreignTurnTimer = setTimeout(() => {
            dispatch(chatApi.util.invalidateTags([{ type: 'ChatMessage', id: conversationId }]));
            later(recoverStalledTurns, 600);
          }, FOREIGN_TURN_CATCHUP_DELAY_MS);
        };

        const patch = (messageId: string, apply: (message: ChatMessage) => void) => {
          updateCachedData((draft) => {
            const index = findIndexById(draft.items, messageId);
            const target = index === -1 ? undefined : draft.items[index];
            if (target) apply(target);
          });
        };

        const onCreated = (message: ChatMessage) => {
          if (message.conversationId !== conversationId) return;
          updateCachedData((draft) => {
            upsertMessage(draft.items, message);
          });
          refreshThreadList();

          // This device's own turn (sent over HTTP, or the socket echo of a
          // send it made itself) needs no catch-up — its reply is already
          // being awaited through the normal streaming/recovery paths.
          if (message.role === 'USER' && !ownsTurn(message.id)) {
            scheduleForeignTurnCatchUp();
          }
        };

        const onPending = (frame: { messageId: string; sequence: number; replyToId: string | null }) => {
          // Hop two of the correlation chain: an assistant turn answering
          // one of ours is ours too, which is what a Stop button and the
          // cancel-affordance key off downstream.
          noteOwnReply(frame.messageId, frame.replyToId);

          updateCachedData((draft) => {
            if (findIndexById(draft.items, frame.messageId) !== -1) return;
            // Only adopt a placeholder for a turn this transcript actually
            // knows about — a pending frame naming a `replyToId` outside
            // the loaded window is not this screen's to render.
            const belongsHere =
              frame.replyToId !== null && draft.items.some((item) => item.id === frame.replyToId);
            if (!belongsHere) return;

            nextChunk.set(frame.messageId, 0);
            draft.items.unshift({
              id: frame.messageId,
              conversationId,
              role: 'ASSISTANT',
              authorUserId: null,
              agentId: null,
              body: '',
              richContent: null,
              status: 'STREAMING',
              sequence: frame.sequence,
              replyToId: frame.replyToId,
              modelSlug: null,
              providerServed: null,
              timeToFirstTokenMs: null,
              generationMs: null,
              errorCode: null,
              errorMessage: null,
              createdAt: new Date().toISOString(),
              attachments: [],
              citations: [],
            });
          });
        };

        const onDelta = (frame: DeltaFrame) => {
          const expected = nextChunk.get(frame.messageId);
          if (expected === undefined) {
            // Not a row this device is tracking as live — either it is not
            // in the loaded window, or the stream was already abandoned to
            // a resync. Either way, applying it would write into nothing
            // the recovery sweep is watching.
            return;
          }
          if (frame.chunkIndex !== expected) {
            // A hole. Rendering the rest anyway produces text with a gap in
            // it that reads as a model failure — stop trusting this stream
            // and let a resync bring the authoritative version instead.
            nextChunk.delete(frame.messageId);
            requestResync(
              conversationId,
              `Chunk ${frame.chunkIndex} arrived where ${expected} was expected.`,
            );
            return;
          }
          nextChunk.set(frame.messageId, expected + 1);
          patch(frame.messageId, (message) => {
            message.body += frame.chunk;
            message.status = 'STREAMING';
          });
        };

        const onComplete = (frame: CompleteFrame) => {
          nextChunk.delete(frame.messageId);
          patch(frame.messageId, (message) => {
            // Authoritative — replace, never append. Deltas can have been
            // dropped and this is the reconciliation point.
            message.body = frame.body;
            message.status = 'COMPLETE';
            message.sequence = frame.sequence;
            message.modelSlug = frame.modelSlug;
            message.providerServed = frame.providerServed;
            message.timeToFirstTokenMs = frame.timeToFirstTokenMs;
            message.generationMs = frame.generationMs;
          });
          refreshThreadList();
        };

        const onFailed = (frame: FailedFrame) => {
          nextChunk.delete(frame.messageId);
          patch(frame.messageId, (message) => {
            message.status = 'FAILED';
            message.errorCode = frame.code;
            message.errorMessage = frame.message;
            message.retryable = frame.retryable;
          });
        };

        const onCancelled = (frame: CancelledFrame) => {
          nextChunk.delete(frame.messageId);
          patch(frame.messageId, (message) => {
            message.status = 'CANCELLED';
            // `reason` is absent on an explicit stop; keeping the
            // distinction is what lets the UI say "top up" rather than
            // "you cancelled" when the wallet ran dry mid-answer.
            message.cancelReason = frame.reason ?? 'user';
          });
        };

        // Reassigned once `cacheDataLoaded` resolves — subscribing before
        // then risks `updateCachedData` running against an entry that has
        // no data yet. Declared here so `finally` can always call them.
        let unsubscribeStatus: () => void = () => undefined;
        let unsubscribeResync: () => void = () => undefined;
        let unsubscribeResumed: () => void = () => undefined;
        let unsubscribeJoined: () => void = () => undefined;
        const unsubscribeMessageEvents: Array<() => void> = [];

        try {
          await cacheDataLoaded;

          // Every socket-status transition away from 'connected' invalidates
          // whatever `nextChunk` believed — those streams belong to a
          // connection that is going or gone, and their rows are now
          // candidates for the recovery sweep once the socket comes back
          // (`roomJoined`/`resumed` below trigger that sweep).
          unsubscribeStatus = onChatSocketStatus((socketStatus) => {
            if (socketStatus !== 'connected') nextChunk.clear();
          });

          // A resume that outran the replay buffer, or a chunk-gap resync —
          // refetch rather than patch further, then sweep once the refetch
          // has had a moment to land (it can itself come back with a row
          // still STREAMING, whose frames died with the old socket).
          unsubscribeResync = onChatLocalEvent('resync', (payload) => {
            if (payload.conversationId !== conversationId) return;
            nextChunk.clear();
            dispatch(chatApi.util.invalidateTags([{ type: 'ChatMessage', id: conversationId }]));
            later(recoverStalledTurns, 600);
          });

          // A resume inside the buffer: the frames missed while this room was
          // unjoined, replayed. Raised even when `missed` is empty, because
          // that is precisely the case worth checking — a turn mid-flight
          // when the socket died has its remaining frames dropped, not
          // redirected, so nothing was "missed" in the server's sense and the
          // bubble is still sitting at STREAMING/PENDING with nothing coming.
          unsubscribeResumed = onChatLocalEvent('resumed', (payload) => {
            if (payload.conversationId !== conversationId) return;
            updateCachedData((draft) => {
              payload.missed.forEach((message) => upsertMessage(draft.items, message));
            });
            recoverStalledTurns();
          });

          // The very first join for this screen also warrants a sweep — the
          // room might already have a turn mid-flight from before this
          // device joined (someone else's, or this device's own orphaned by
          // an earlier reconnect that happened before this cache entry
          // existed).
          unsubscribeJoined = onChatLocalEvent('roomJoined', (payload) => {
            if (payload.conversationId !== conversationId) return;
            later(recoverStalledTurns, 300);
          });

          // THE FIRST SWEEP, easy to forget and important not to: opening a
          // conversation that is already mid-answer (this device's own turn
          // from before a reload, or one only visible via this room) loads
          // a transcript with a row reading STREAMING/PENDING and nothing
          // guaranteed to finish it.
          recoverStalledTurns();

          // `onChatSocketEvent` (unlike a raw `socket.on`) works even before
          // a `Socket` object exists — see chatSocket.ts's `serverListeners`
          // note. Registering here, unconditionally, is what used to be
          // silently skipped whenever this cache entry mounted before
          // `connectChatSocket()`'s async cookie read had finished: sends
          // still acked fine, but nothing was listening for the reply.
          unsubscribeMessageEvents.push(
            onChatSocketEvent('message:created', onCreated),
            onChatSocketEvent('message:pending', onPending),
            onChatSocketEvent('message:delta', onDelta),
            onChatSocketEvent('message:complete', onComplete),
            onChatSocketEvent('message:failed', onFailed),
            onChatSocketEvent('message:cancelled', onCancelled),
          );

          await cacheEntryRemoved;
        } catch {
          // cacheDataLoaded rejects when the entry is removed before the
          // first successful fetch — nothing was subscribed, nothing to undo.
        } finally {
          unsubscribeMessageEvents.forEach((off) => off());
          unsubscribeStatus();
          unsubscribeResync();
          unsubscribeResumed();
          unsubscribeJoined();
          if (listRefreshTimer) clearTimeout(listRefreshTimer);
          if (foreignTurnTimer) clearTimeout(foreignTurnTimer);
          timers.forEach((timer) => clearTimeout(timer));
          timers.clear();
          nextChunk.clear();
          recovering.clear();
        }
      },
    }),

    /**
     * One message, in full. The recovery poller's own tool, and also what
     * `docs/chat-module-spec.md` calls out as an endpoint no client here
     * used before this — every read route in the chat module is ungated,
     * so nothing beyond `chat.view`-gated navigation stands between this
     * screen and the call.
     */
    getChatMessage: builder.query<ChatMessage, string>({
      query: (id) => ({ url: `/messages/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'ChatMessage', id }],
    }),

    /**
     * The HTTP send. The socket path is preferred and is driven from the
     * conversation screen; this is the fallback for a down socket, and it
     * carries the SAME idempotency key so the two paths can never produce
     * two messages.
     *
     * Deliberately does not invalidate the transcript tag: the response
     * carries the created message and the caller settles it into the cache
     * directly. A refetch here would discard a reply that has already begun
     * streaming.
     */
    sendChatMessage: builder.mutation<SendMessageResultWire, SendMessageInput>({
      query: ({ conversationId, ...body }) => ({
        url: `/conversations/${conversationId}/messages`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [
        { type: 'ChatBalance', id: conversationId },
        { type: 'ChatThread', id: 'LIST' },
      ],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Claim the turn so this device treats the reply as its own and
          // shows a Stop button rather than polling it like a stranger's.
          if (data?.message?.id) noteOwnTurn(data.message.id);
        } catch {
          // The caller marks its own optimistic row FAILED — it has the
          // error and the context to word it.
        }
      },
    }),

    /** Only a FAILED ASSISTANT turn. Anything else is a 400 naming the
     * status it actually has. Needs its own fresh idempotency key. */
    retryChatMessage: builder.mutation<
      { id: string; conversationId: string; accepted: true },
      { messageId: string; conversationId: string; idempotencyKey: string }
    >({
      query: ({ messageId, idempotencyKey }) => ({
        url: `/messages/${messageId}/retry`,
        method: 'POST',
        body: { idempotencyKey },
      }),
      invalidatesTags: (_r, _e, { conversationId }) => [{ type: 'ChatBalance', id: conversationId }],
    }),

    /** The REST spelling is `upToSequence`; the socket's is `uptoSequence`.
     * This is the REST one. */
    markChatThreadRead: builder.mutation<
      { id: string; readUpToSequence: number },
      { conversationId: string; upToSequence: number }
    >({
      query: ({ conversationId, upToSequence }) => ({
        url: `/conversations/${conversationId}/read`,
        method: 'POST',
        body: { upToSequence },
      }),
    }),

    /* ---------------------------------------------------------------- */
    /* Attachments                                                       */
    /* ---------------------------------------------------------------- */

    createAttachmentIntent: builder.mutation<
      ChatUploadIntent,
      {
        conversationId: string;
        kind: 'FILE' | 'PHOTO' | 'VIDEO' | 'VOICE';
        filename: string;
        mimeType: string;
        sizeBytes: number;
        durationSec?: number;
      }
    >({
      query: (body) => ({ url: '/attachments/upload-intent', method: 'POST', body }),
    }),

    /** Staged attachments only — once an attachment is bound to a sent
     * message this is a 400, because the transcript would then reference
     * something that no longer exists. */
    deleteAttachment: builder.mutation<{ id: string; deleted: true }, string>({
      query: (id) => ({ url: `/attachments/${id}`, method: 'DELETE' }),
    }),

    /**
     * Mints a signed URL that expires in about two minutes. Never cached and
     * never retried — a stale URL is a 403, so the fix is always to mint a
     * new one. Exposed as a lazy query for exactly that reason: it is called
     * at the moment of use, not when a tile renders.
     */
    getAttachmentUrl: builder.query<ChatAttachmentUrl, string>({
      query: (id) => ({ url: `/attachments/${id}/content` }),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetChatThreadsQuery,
  useGetChatThreadQuery,
  useGetAvailableAgentsForChatQuery,
  useCreateChatThreadMutation,
  useUpdateChatThreadMutation,
  usePinChatThreadMutation,
  useSetChatThreadKnowledgeBaseMutation,
  useDeleteChatThreadsMutation,
  useGetChatBalanceQuery,
  useGetChatModelsQuery,
  useSetChatThreadModelMutation,
  useGetChatMessagesQuery,
  useGetChatMessageQuery,
  useSendChatMessageMutation,
  useRetryChatMessageMutation,
  useMarkChatThreadReadMutation,
  useCreateAttachmentIntentMutation,
  useDeleteAttachmentMutation,
  useLazyGetAttachmentUrlQuery,
} = chatApi;

/** Re-exported so the conversation screen can ask "is this reply mine?"
 * without importing the socket module directly. */
export { ownsTurn };
