import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/ui';
import { useAppDispatch } from '@/store/hooks';
import { newIdempotencyKey } from '@/utils/ids';
import { usePermission } from '@/permissions/usePermission';
import { CHAT_PERMISSIONS } from '@/permissions/slugs';
import {
  connectChatSocket,
  emitTypingStart,
  emitTypingStop,
  cancelGeneration,
  ensureConversationJoined,
  forgetConversationRoom,
  getChatSocketStatus,
  isRoomJoined,
  onChatLocalEvent,
  onChatSocketEvent,
  onChatSocketStatus,
  sendSocketMessage,
  ChatAckTimeout,
  isChatSocketConnected,
  type ChatSocketStatus,
  type LimitExceededFrame,
  type TypingFrame,
} from '@/services/chatSocket';

import type { ChatMessage, ChatThread, QueuedMessage } from './chat.types';
import {
  PAYMENT_REQUIRED_NOTE,
  RATE_LIMIT_COOLDOWN_MS,
  SEND_FAILED_NOTE,
  SEND_TIMED_OUT_NOTE,
  SOMEONE_LABEL,
  resolveComposerBlock,
} from './chatRules';
import {
  chatApi,
  useGetChatBalanceQuery,
  useGetChatMessagesQuery,
  useGetChatThreadQuery,
  useSendChatMessageMutation,
} from './chatApi';

/**
 * Orchestrates one open conversation: socket join/leave/resume, the
 * transcript query, the send path (socket-first with an HTTP fallback on
 * the SAME idempotency key), the parked send queue, typing, and the
 * resolved composer block. Everything the conversation screen needs is
 * this one hook's return value — the screen itself stays a rendering
 * layer.
 */
export function useChatConversation(conversationId: string) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const canSendPermission = usePermission(CHAT_PERMISSIONS.SEND);

  const threadQuery = useGetChatThreadQuery(conversationId);
  const messagesQuery = useGetChatMessagesQuery({ conversationId });
  // Billing can change without any action on this screen (another device
  // topping up, a cap resetting) — refetch when the screen regains focus,
  // the one query in the module that does, mirroring the web.
  const balanceQuery = useGetChatBalanceQuery(conversationId, { refetchOnFocus: true });
  const [sendMessageHttp] = useSendChatMessageMutation();

  const [socketStatus, setSocketStatus] = useState<ChatSocketStatus>(() => getChatSocketStatus().status);
  const [isJoined, setIsJoined] = useState(() => isRoomJoined(conversationId));
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [typingActors, setTypingActors] = useState<Map<string, { name: string; at: number }>>(new Map());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = threadQuery.data;
  const messages = messagesQuery.data?.items ?? [];

  const isStreaming = messages.some((m) => m.status === 'STREAMING');
  const streamingMessageId = messages.find((m) => m.status === 'STREAMING')?.id ?? null;

  /* ---------------------------------------------------------------- */
  /* Connect + join + resume                                           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setIsJoined(isRoomJoined(conversationId));

    const unsubscribeStatus = onChatSocketStatus((nextStatus) => {
      setSocketStatus(nextStatus);
      // A drop takes the room membership down with it — the server forgets
      // this socket's rooms on disconnect, and `resumeAllRooms` (inside
      // chatSocket.ts) is what re-establishes them, not an assumption that
      // reconnecting alone is enough.
      if (nextStatus !== 'connected') setIsJoined(false);
    });

    // `roomJoined` fires once for THIS conversation every time chatSocket
    // (re)joins it — the very first join, and every reconnect afterwards.
    // Recovering any turn whose frames were missed while unjoined is that
    // module's job (see chatApi.ts's onCacheEntryAdded); this hook only
    // needs to know whether it is currently safe to prefer the socket send
    // path over the HTTP fallback.
    const unsubscribeJoined = onChatLocalEvent('roomJoined', (payload) => {
      if (payload.conversationId === conversationId) setIsJoined(true);
    });

    // Registers this conversation so it joins now (if already connected)
    // and stays joined across however many reconnects happen while this
    // screen is mounted — see chatSocket.ts's "Room membership does not
    // survive a reconnect" note for why a one-shot join used to be a bug.
    void connectChatSocket().then(() => {
      ensureConversationJoined(conversationId);
    });

    // `connectChatSocket()` above only runs once, on mount. If the app is
    // backgrounded and the socket drops (or the connect attempt above is
    // still the terminal `'error'` from a cold-start cookie-jar race — see
    // chatSocket.ts's `getSessionCookieWithRetry` note), nothing else ever
    // calls it again: socket.io's own backoff only helps once a `Socket`
    // instance exists, and this module never builds one after a token-read
    // failure. Retrying on every foreground transition is what used to be
    // missing — without it, "kill the app, reopen it" could leave the
    // conversation permanently stuck showing "Not connected" for the rest
    // of the session.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || isChatSocketConnected()) return;
      void connectChatSocket().then(() => {
        ensureConversationJoined(conversationId);
      });
    });

    return () => {
      unsubscribeStatus();
      unsubscribeJoined();
      appStateSub.remove();
      forgetConversationRoom(conversationId);
      setIsJoined(false);
    };
  }, [conversationId]);

  /* ---------------------------------------------------------------- */
  /* Typing (inbound) and limit:exceeded / conversation:updated         */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onTyping = (frame: TypingFrame) => {
      if (frame.conversationId !== conversationId) return;
      setTypingActors((prev) => {
        const next = new Map(prev);
        if (frame.isTyping) next.set(frame.actor.userId, { name: frame.actor.displayName ?? SOMEONE_LABEL, at: Date.now() });
        else next.delete(frame.actor.userId);
        return next;
      });
    };

    const onLimitExceeded = (frame: LimitExceededFrame) => {
      if (frame.conversationId && frame.conversationId !== conversationId) return;
      if (frame.scope === 'RPM' && frame.origin === 'send') {
        setRateLimitedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        toast.show(frame.message, { tone: 'warning' });
      } else if (frame.scope === 'SPEND') {
        toast.show(frame.message, { tone: 'warning' });
      }
      // origin === 'action' RPM hits are absorbed silently, matching web —
      // they are join/resume/read/cancel noise, not something to nag about.
    };

    const onConversationUpdated = (updated: ChatThread) => {
      if (updated.id !== conversationId) return;
      dispatch(chatApi.util.upsertQueryData('getChatThread', conversationId, updated));
    };

    // `onChatSocketEvent`, not a raw `getChatSocket()?.on(...)` — this effect
    // runs on mount, which races `connectChatSocket()`'s async cookie read
    // (see chatSocket.ts's `serverListeners` note). A raw socket lookup here
    // used to silently bind nothing whenever that race lost, and — because
    // the dependency array has no "socket is ready now" trigger — it never
    // retried, leaving typing indicators and rate-limit toasts dead for the
    // rest of the screen's mount.
    const unsubscribeTyping = onChatSocketEvent('typing', onTyping);
    const unsubscribeLimitExceeded = onChatSocketEvent('limit:exceeded', onLimitExceeded);
    const unsubscribeConversationUpdated = onChatSocketEvent('conversation:updated', onConversationUpdated);
    return () => {
      unsubscribeTyping();
      unsubscribeLimitExceeded();
      unsubscribeConversationUpdated();
    };
  }, [conversationId, dispatch, toast]);

  // Prune stale typing actors every couple of seconds — the server's own
  // typing key TTL is 5s; 8s local staleness matches the web's margin.
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingActors((prev) => {
        const cutoff = Date.now() - 8000;
        let changed = false;
        const next = new Map(prev);
        for (const [id, actor] of prev) {
          if (actor.at < cutoff) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // A rate-limit block lifts itself once its cooldown elapses.
  useEffect(() => {
    if (rateLimitedUntil === null) return;
    const remaining = rateLimitedUntil - Date.now();
    if (remaining <= 0) {
      setRateLimitedUntil(null);
      return;
    }
    const timer = setTimeout(() => setRateLimitedUntil(null), remaining);
    return () => clearTimeout(timer);
  }, [rateLimitedUntil]);

  /* ---------------------------------------------------------------- */
  /* Composer block                                                     */
  /* ---------------------------------------------------------------- */

  const composerBlock = useMemo(
    () =>
      resolveComposerBlock({
        thread,
        canSend: canSendPermission,
        rateLimitedUntil,
        balance: balanceQuery.data,
      }),
    [thread, canSendPermission, rateLimitedUntil, balanceQuery.data],
  );

  /* ---------------------------------------------------------------- */
  /* Sending                                                            */
  /* ---------------------------------------------------------------- */

  const insertOptimistic = useCallback(
    (message: ChatMessage) => {
      dispatch(
        chatApi.util.updateQueryData('getChatMessages', { conversationId }, (draft) => {
          draft.items.unshift(message);
        }),
      );
    },
    [conversationId, dispatch],
  );

  const settleMessage = useCallback(
    (idempotencyKey: string, apply: (message: ChatMessage) => void) => {
      dispatch(
        chatApi.util.updateQueryData('getChatMessages', { conversationId }, (draft) => {
          const target = draft.items.find((m) => m.idempotencyKey === idempotencyKey && m.isOptimistic);
          if (target) apply(target);
        }),
      );
    },
    [conversationId, dispatch],
  );

  const dispatchMessage = useCallback(
    async (body: string, attachmentIds: string[]) => {
      const idempotencyKey = newIdempotencyKey();
      const optimisticId = `optimistic-${idempotencyKey}`;
      // Cosmetic only — the optimistic row's sequence is overwritten by
      // the real one the moment the send settles. Falls back to 0 for a
      // conversation whose transcript has not loaded any messages yet.
      const nextSequence = (messages[0]?.sequence ?? 0) + 1;

      insertOptimistic({
        id: optimisticId,
        conversationId,
        role: 'USER',
        authorUserId: null,
        agentId: null,
        body,
        richContent: null,
        status: 'PENDING',
        sequence: nextSequence,
        replyToId: null,
        modelSlug: null,
        providerServed: null,
        timeToFirstTokenMs: null,
        generationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        attachments: [],
        citations: [],
        isOptimistic: true,
        idempotencyKey,
      });

      if (isChatSocketConnected() && isJoined) {
        try {
          const ack = await sendSocketMessage({ conversationId, body, attachmentIds, idempotencyKey });
          if (ack.ok) {
            settleMessage(idempotencyKey, (message) => {
              message.id = ack.data.messageId;
              message.sequence = ack.data.sequence;
              message.status = 'COMPLETE';
              message.isOptimistic = false;
            });
            return;
          }
          if (!ack.error.retryable) {
            const isPayment = ack.error.code === 'INTERNAL';
            settleMessage(idempotencyKey, (message) => {
              message.status = 'FAILED';
              message.errorCode = ack.error.code;
              message.errorMessage = isPayment ? PAYMENT_REQUIRED_NOTE : ack.error.message;
              message.retryable = false;
            });
            toast.show(isPayment ? PAYMENT_REQUIRED_NOTE : ack.error.message, { tone: 'error' });
            return;
          }
          // Retryable NACK (rate limited, internal): re-check balance before
          // giving up, since a 402 crossing the socket surfaces as INTERNAL
          // with retryable:true — looping here would hammer an empty wallet.
          void balanceQuery.refetch();
        } catch (err) {
          if (!(err instanceof ChatAckTimeout)) throw err;
          // Silence — fall through to the HTTP fallback below with the SAME
          // key, so a send that actually landed is recognised as a replay.
        }
      }

      try {
        const result = await sendMessageHttp({ conversationId, body, idempotencyKey, attachmentIds }).unwrap();
        settleMessage(idempotencyKey, (message) => {
          message.id = result.message.id;
          message.sequence = result.message.sequence;
          message.status = 'COMPLETE';
          message.isOptimistic = false;
        });
      } catch (err) {
        const status = (err as { status?: number | string })?.status;
        const isPayment = status === 402;
        settleMessage(idempotencyKey, (message) => {
          message.status = 'FAILED';
          message.retryable = !isPayment;
          message.errorMessage = isPayment
            ? PAYMENT_REQUIRED_NOTE
            : isChatSocketConnected()
              ? SEND_FAILED_NOTE
              : SEND_TIMED_OUT_NOTE;
        });
        toast.show(isPayment ? PAYMENT_REQUIRED_NOTE : SEND_FAILED_NOTE, { tone: 'error' });
      }
    },
    [balanceQuery, conversationId, insertOptimistic, isJoined, messages, sendMessageHttp, settleMessage, toast],
  );

  // Drains the queue one turn at a time as the path clears — a previous
  // answer finishing, or a block lifting.
  useEffect(() => {
    if (queue.length === 0 || isStreaming || composerBlock) return;
    const [next, ...rest] = queue;
    if (!next) return;
    setQueue(rest);
    void dispatchMessage(next.body, next.attachmentIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, isStreaming, composerBlock]);

  const send = useCallback(
    (body: string, attachmentIds: string[] = []) => {
      const isPathClear = !isStreaming && !composerBlock && queue.length === 0;
      if (isPathClear) {
        void dispatchMessage(body, attachmentIds);
        return;
      }
      setQueue((prev) => [...prev, { id: newIdempotencyKey(), conversationId, body, attachmentIds, state: 'waiting' }]);
    },
    [composerBlock, conversationId, dispatchMessage, isStreaming, queue.length],
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /* ---------------------------------------------------------------- */
  /* Cancel                                                             */
  /* ---------------------------------------------------------------- */

  const cancelStream = useCallback(async () => {
    if (!streamingMessageId) return;
    if (!isChatSocketConnected()) {
      toast.show('Cancelling needs the live connection, and it is down.', { tone: 'warning' });
      return;
    }
    const ack = await cancelGeneration(streamingMessageId).catch(() => null);
    if (ack?.ok) {
      dispatch(
        chatApi.util.updateQueryData('getChatMessages', { conversationId }, (draft) => {
          const target = draft.items.find((m) => m.id === streamingMessageId);
          if (target) {
            target.status = 'CANCELLED';
            target.cancelReason = 'user';
          }
        }),
      );
    } else if (ack && !ack.ok) {
      toast.show(ack.error.message, { tone: 'warning' });
    }
  }, [conversationId, dispatch, streamingMessageId, toast]);

  /* ---------------------------------------------------------------- */
  /* Typing (outbound)                                                  */
  /* ---------------------------------------------------------------- */

  const onTyping = useCallback(() => {
    emitTypingStart(conversationId);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTypingStop(conversationId), 2200);
  }, [conversationId]);

  const onStopTyping = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    emitTypingStop(conversationId);
  }, [conversationId]);

  const typingLabel = useMemo(() => {
    const names = Array.from(typingActors.values()).map((a) => a.name);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing…`;
    return `${names.length} people are typing…`;
  }, [typingActors]);

  return {
    thread,
    threadError: threadQuery.error,
    isThreadLoading: threadQuery.isLoading,
    messages,
    isMessagesLoading: messagesQuery.isLoading,
    messagesError: messagesQuery.error,
    hasMoreMessages: messagesQuery.data?.hasMore ?? false,
    loadOlderMessages: () => {
      const cursor = messagesQuery.data?.nextCursor;
      if (!cursor) return;
      // Same cache entry as the base query (serializeQueryArgs keys only on
      // conversationId) — this extends the transcript's tail rather than
      // starting a second, separate list.
      dispatch(chatApi.endpoints.getChatMessages.initiate({ conversationId, cursor }));
    },
    isLoadingOlder: messagesQuery.isFetching && !messagesQuery.isLoading,
    balance: balanceQuery.data,
    socketStatus,
    isSocketConnected: socketStatus === 'connected',
    isStreaming,
    streamingMessageId,
    canCancel: socketStatus === 'connected',
    composerBlock,
    queue,
    removeFromQueue,
    send,
    cancelStream,
    onTyping,
    onStopTyping,
    typingLabel,
    refetchMessages: messagesQuery.refetch,
  };
}
