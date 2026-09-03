import { io, type Socket } from 'socket.io-client';

import { env } from '@/config/env';
import type { ChatMessage } from '@/features/chat/chat.types';

import { getSessionCookie } from './cookieAuth';

/**
 * The chat Socket.IO connection — one singleton for the whole app.
 *
 * ## Why a singleton
 * The gateway auto-joins `tenant:{id}` and `user:{id}` on connect and keeps
 * per-socket rate budgets (30 sends/min, 60 actions/min). A second
 * connection would double the tenant fan-out and halve the effective
 * budget for no benefit, so screens share this one and join/leave
 * conversation rooms on top of it.
 *
 * ## Authentication
 * The gateway reads the token from, in order: `handshake.auth.token`, an
 * `Authorization: Bearer` header, then the `b2b_session` cookie. This app
 * has no bearer token — the session is an httpOnly cookie in the native jar
 * (see cookieAuth.ts). React Native's WebSocket cannot be relied on to send
 * a `Cookie` header, so instead we read the cookie's VALUE out of the jar
 * and hand it over as `auth.token`: that value *is* the JWT, and the first
 * branch of the server's resolver accepts it directly. The query string is
 * never read by the server — do not put the token there.
 *
 * ## Room membership does not survive a reconnect
 * Every conversation room is scoped to a socket connection server-side —
 * `handleConnection`/`handleDisconnect` say so explicitly, and a reconnect
 * gets a brand new socket id. The web client's own `chatSocket.ts` handles
 * this by re-running `join` + `connection:resume` for every room it knows
 * about on EVERY `connect` event, not just the first one — that is what
 * `resumeAllRooms()` below ports. A version of this file once joined a
 * conversation exactly once, right after the initial connect: after any
 * later drop-and-reconnect the socket looked "connected" again but the
 * server had long forgotten the room, so `message:created`/`:pending`/etc
 * for that conversation went nowhere and a turn sent while reconnecting
 * (or shortly after) could get a reply that this device never learned
 * about. `registerConversationRoom`/`ensureConversationJoined` are the
 * fix — a screen registers interest once and the module keeps it joined
 * across however many reconnects happen while it is mounted.
 *
 * ## What this module deliberately does NOT do
 * It does not own any chat state beyond room membership and turn
 * ownership. Frames are handed to subscribers and the only place a
 * message lives is the RTK Query cache (see chatApi.ts). It also does not
 * retry sends: an ack carries `retryable` and the caller decides, because
 * one of the retryable-looking failures is an empty wallet (see
 * `SEND_ACK_TIMEOUT_MS` note below and docs/chat-module-spec.md §2).
 */

export const CHAT_NAMESPACE = '/chat';

/** Long enough to survive a slow handshake, short enough that a wedged
 * request does not leave a bubble spinning forever. Silence from the server
 * means "never received" — the caller then falls back to HTTP with the same
 * idempotency key, which makes the double-send safe. */
const ACK_TIMEOUT_MS = 10000;

/**
 * After this many consecutive `UNAUTHENTICATED`/`TOKEN_EXPIRED` rejections
 * in a row, stop matching socket.io's fast default backoff (it retries in
 * well under a second once warmed up) and wait this much longer before the
 * next attempt. A bad credential does not become good by trying again
 * immediately — all that does is hammer the gateway with an identical
 * rejection every few hundred milliseconds. One slower retry, with the
 * cookie re-read right before it, gives a session that genuinely refreshed
 * a chance to be picked up without a fast-fail loop in the meantime.
 */
const AUTH_FAILURE_BACKOFF_MS = 15000;
const AUTH_FAILURE_STREAK_THRESHOLD = 2;

/**
 * On a cold start (app was force-quit and just relaunched), the native
 * cookie jar bridge can take a beat to warm up — `getSessionCookie()` can
 * read back nothing for the first attempt or two even though the session is
 * genuinely still valid (a REST call a moment later reads it fine). Without
 * a retry here, that single blip used to be terminal: `connectChatSocket()`
 * set status `'error'` and returned without ever creating a `Socket`, so
 * socket.io's own reconnection/backoff never got a connection to retry —
 * nothing else in the app calls `connectChatSocket()` again on its own, so
 * the UI was stuck showing "Not connected" for the rest of the session even
 * though sends kept working over the HTTP fallback. These few short retries
 * absorb that startup race; a device that is genuinely signed out still
 * ends up at the same terminal `'error'` state, just ~2.5s later.
 */
const COOKIE_READ_RETRY_DELAYS_MS = [300, 800, 1500];

async function getSessionCookieWithRetry(): Promise<string | undefined> {
  for (const delay of COOKIE_READ_RETRY_DELAYS_MS) {
    const token = await getSessionCookie();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return getSessionCookie();
}

/* -------------------------------------------------------------------------- */
/* Wire shapes                                                                 */
/* -------------------------------------------------------------------------- */

export type ChatErrorCode =
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'NOT_IN_ROOM'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TOO_MANY_IN_FLIGHT'
  | 'RESUME_WINDOW_EXCEEDED'
  | 'INTERNAL';

export interface ChatAckError {
  code: ChatErrorCode;
  message: string;
  /** Surface this in bug reports — the same id is in the server log. */
  correlationId: string;
  /** Read this flag rather than keeping a client-side table of codes.
   * One caveat the server cannot express: an HTTP 402 crossing the broker
   * is mapped to `INTERNAL` with `retryable: true`, so a send that comes
   * back INTERNAL must re-check the balance before trying again or the
   * client will loop on an empty wallet. */
  retryable: boolean;
}

export type ChatAck<T> = { ok: true; data: T } | { ok: false; error: ChatAckError };

export interface SocketSendPayload {
  conversationId: string;
  body: string;
  attachmentIds?: string[];
  idempotencyKey: string;
  /** Client clock — used for round-trip measurement only, never ordering. */
  clientSentAt?: string;
}

export interface SocketSendAck {
  messageId: string;
  sequence: number;
  /** False means the idempotency key was a replay. Still a success. */
  created: boolean;
}

export interface ResumeAck {
  /** Oldest first. Empty when `refetchRequired` is true. Full message rows
   * — the shared backend contract types this `unknown[]`, but the web
   * client's own working implementation treats every entry as a complete
   * message (see messages.api.ts's `resumed.data.missed.forEach(upsert...)`),
   * and that is the ground truth this app follows too. */
  missed: ChatMessage[];
  /** The server had more than its 100-row resume cap: drop the local tail
   * and refetch the transcript over REST. */
  refetchRequired: boolean;
  currentSequence: number;
}

export interface DeltaFrame {
  messageId: string;
  chunk: string;
  /** Increments only on a real emit — the 80ms coalescing does not skip
   * indices, so a gap here is a genuinely lost frame and means resync. */
  chunkIndex: number;
}

export interface CompleteFrame {
  messageId: string;
  sequence: number;
  /** AUTHORITATIVE. Replace the accumulated deltas with this; do not
   * append it to them. */
  body: string;
  modelSlug: string | null;
  providerServed: string | null;
  citations: unknown[];
  timeToFirstTokenMs: number | null;
  generationMs: number | null;
  richContent: unknown;
}

export interface FailedFrame {
  messageId: string;
  code: string;
  message: string;
  retryable: boolean;
}

export interface CancelledFrame {
  messageId: string;
  charged: false;
  /** Absent on an explicit user cancel. `insufficient_balance` is the ONLY
   * thing distinguishing "the money ran out" from "you pressed stop", and
   * they need different copy. */
  reason?: 'user' | 'insufficient_balance';
}

export interface LimitExceededFrame {
  conversationId?: string;
  scope: 'RPM' | 'SPEND' | 'IN_FLIGHT';
  /** Only present on the RPM variant emitted by the gateway. */
  origin?: 'send' | 'action';
  message: string;
}

export interface TypingFrame {
  conversationId: string;
  /** The gateway emits `{ userId }` only — it never populates
   * `displayName`, so names have to be resolved client-side. */
  actor: { userId: string; displayName?: string };
  isTyping: boolean;
}

export interface UsageUpdatedFrame {
  conversationId: string;
  /* The declared interface and the emitted payload disagree (see the spec
     doc §2). Both key sets are optional so either shape parses. */
  messageId?: string;
  promptTokens?: number;
  completionTokens?: number;
  costCents?: number;
  totalCostCents?: number;
  totalTokens?: number;
}

export type ChatSocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/* -------------------------------------------------------------------------- */
/* Singleton                                                                   */
/* -------------------------------------------------------------------------- */

let socket: Socket | null = null;
let status: ChatSocketStatus = 'idle';
let lastError: string | null = null;

/** Consecutive UNAUTHENTICATED/TOKEN_EXPIRED rejections. Reset on any
 * connect that does not immediately get one back. See
 * `AUTH_FAILURE_BACKOFF_MS`. */
let authFailureStreak = 0;
let authBackoffTimer: ReturnType<typeof setTimeout> | null = null;

const statusListeners = new Set<(status: ChatSocketStatus, error: string | null) => void>();

function setStatus(next: ChatSocketStatus, error: string | null = null) {
  status = next;
  lastError = error;
  for (const listener of statusListeners) listener(next, error);
}

export function getChatSocketStatus(): { status: ChatSocketStatus; error: string | null } {
  return { status, error: lastError };
}

export function onChatSocketStatus(
  listener: (status: ChatSocketStatus, error: string | null) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/* -------------------------------------------------------------------------- */
/* Local events                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Events this module raises itself — they never cross the wire. Ported
 * from the web client's own `LocalEvents` (chatSocket.ts there): the cache
 * layer (chatApi.ts) subscribes to these rather than reaching into
 * connection internals.
 */
export interface ChatLocalEvents {
  /** A resume replayed everything the room's `lastSequence` had missed —
   * raised even when `missed` is empty, because that is precisely the case
   * where a row can be sitting at STREAMING with nothing coming for it
   * (its old socket died with the frames still in flight). */
  resumed: (payload: { conversationId: string; missed: ChatMessage[] }) => void;
  /** The gap was bigger than the server can replay, or a delta arrived
   * with a hole in its `chunkIndex`. The cache layer must stop trusting
   * what it has and refetch over REST rather than patch further. */
  resync: (payload: { conversationId: string; reason: string }) => void;
  /** This device successfully joined (or re-joined) a conversation room. */
  roomJoined: (payload: { conversationId: string; currentSequence: number }) => void;
}

type ChatLocalEventName = keyof ChatLocalEvents;

const localListeners = new Map<ChatLocalEventName, Set<(payload: never) => void>>();

function emitLocal<E extends ChatLocalEventName>(event: E, payload: Parameters<ChatLocalEvents[E]>[0]): void {
  localListeners.get(event)?.forEach((handler) => {
    (handler as (value: typeof payload) => void)(payload);
  });
}

export function onChatLocalEvent<E extends ChatLocalEventName>(
  event: E,
  handler: ChatLocalEvents[E],
): () => void {
  const set = localListeners.get(event) ?? new Set<(payload: never) => void>();
  set.add(handler as (payload: never) => void);
  localListeners.set(event, set);
  return () => {
    set.delete(handler as (payload: never) => void);
  };
}

/** A delta arrived with a hole in `chunkIndex`, or anything else that means
 * the cache layer's copy of a transcript can no longer be trusted. */
export function requestResync(conversationId: string, reason: string): void {
  emitLocal('resync', { conversationId, reason });
}

/* -------------------------------------------------------------------------- */
/* Conversation room membership — survives reconnects                         */
/* -------------------------------------------------------------------------- */

/** Rooms this device wants to be in, and the highest sequence seen in each —
 * used as `lastSequence` on the NEXT resume, whether that is the first join
 * or the fifth reconnect. */
const rooms = new Map<string, number>();

/** Rooms the SERVER currently thinks this socket is in. Cleared on every
 * disconnect (room membership is per-connection, not per-device) and
 * rebuilt as `resumeAllRooms` rejoins each one. */
const joinedRooms = new Set<string>();

export function noteRoomSequence(conversationId: string, sequence: number): void {
  const current = rooms.get(conversationId);
  if (current === undefined || sequence > current) rooms.set(conversationId, sequence);
}

export function isRoomJoined(conversationId: string): boolean {
  return joinedRooms.has(conversationId);
}

async function joinAndResumeRoom(conversationId: string): Promise<void> {
  const lastSequence = rooms.get(conversationId) ?? 0;

  const joined = await joinConversation(conversationId).catch(() => null);
  if (!joined?.ok) return;

  joinedRooms.add(conversationId);
  noteRoomSequence(conversationId, joined.data.currentSequence);
  emitLocal('roomJoined', { conversationId, currentSequence: joined.data.currentSequence });

  const resumed = await resumeConversation(conversationId, lastSequence).catch(() => null);
  if (!resumed?.ok) {
    emitLocal('resync', {
      conversationId,
      reason: resumed?.error.message ?? 'Could not resume this conversation.',
    });
    return;
  }
  if (resumed.data.refetchRequired) {
    emitLocal('resync', { conversationId, reason: 'The gap was larger than the server can replay.' });
    return;
  }
  emitLocal('resumed', { conversationId, missed: resumed.data.missed });
  noteRoomSequence(conversationId, resumed.data.currentSequence);
}

/** Re-join and resume EVERY registered room. Called on every successful
 * connect — the initial one and every reconnect — because the server's
 * room membership dies with the socket that held it. Rooms are walked one
 * at a time (not in parallel) so replayed frames for one conversation
 * cannot interleave with another's while the cache is applying them,
 * matching the web client's own `resumeAllRooms`. */
async function resumeAllRooms(): Promise<void> {
  for (const conversationId of Array.from(rooms.keys())) {
    await joinAndResumeRoom(conversationId);
  }
}

/**
 * Register interest in a conversation room and join it now if the socket is
 * already connected. Safe to call repeatedly — a screen calls this on
 * mount without coordinating with any other screen. If the socket is not
 * yet connected (or is mid-reconnect), the join happens automatically the
 * next time `connect` fires, via `resumeAllRooms`.
 */
export function ensureConversationJoined(conversationId: string): void {
  if (!rooms.has(conversationId)) rooms.set(conversationId, 0);
  if (isChatSocketConnected() && !joinedRooms.has(conversationId)) {
    void joinAndResumeRoom(conversationId);
  }
}

/** The inverse of `ensureConversationJoined` — stop tracking this room
 * (no more auto-rejoin-on-reconnect) and tell the server if still
 * connected. */
export function forgetConversationRoom(conversationId: string): void {
  rooms.delete(conversationId);
  joinedRooms.delete(conversationId);
  if (socket?.connected) void leaveConversation(conversationId).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Server-event subscriptions — resilient to not having a socket yet          */
/* -------------------------------------------------------------------------- */

/**
 * Handlers registered through `onChatSocketEvent`, held here rather than
 * only on the `Socket` object.
 *
 * `chatApi.ts`'s `onCacheEntryAdded` calls `getChatSocket()` and wires
 * `message:pending`/`:delta`/`:complete`/etc. straight onto it — but that
 * runs the instant the screen's query subscribes, which is normally BEFORE
 * `connectChatSocket()`'s async cookie read and `io(...)` call have had a
 * chance to create a `Socket` at all (and strictly before it *connects*).
 * A plain `socket?.on(...)` at that moment binds nothing, permanently, for
 * the lifetime of that cache entry: the ack for a send still resolves
 * (`emitWithAck` reads `socket` fresh at call time, by when it usually
 * exists), so the message appears to send fine, but every frame carrying
 * the assistant's reply has nothing listening for it. This registry is
 * what the web client's own `chatSocket.ts` (`serverListeners`) uses to
 * avoid exactly this: a caller can subscribe before a connection exists,
 * and `connectChatSocket()` rebinds every entry the moment it actually
 * creates a `Socket`.
 */
const serverListeners = new Set<{ event: string; handler: (...args: never[]) => void }>();

/**
 * Subscribe to a raw server event by name (`message:pending`,
 * `message:delta`, `typing`, `conversation:updated`, …) — resilient to
 * being called before any `Socket` exists yet. Returns its own unsubscribe.
 */
export function onChatSocketEvent<Args extends unknown[]>(
  event: string,
  handler: (...args: Args) => void,
): () => void {
  const entry = { event, handler: handler as unknown as (...args: never[]) => void };
  serverListeners.add(entry);
  socket?.on(event, handler as never);
  return () => {
    serverListeners.delete(entry);
    socket?.off(event, handler as never);
  };
}

/* -------------------------------------------------------------------------- */
/* Connection lifecycle                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Connects if not already connected. Safe to call repeatedly — screens call
 * it on focus without coordinating with each other.
 *
 * Reconnection is left to socket.io's own backoff, but the token is
 * re-read from the cookie jar on every attempt: a reconnect after the
 * session was refreshed must not present the old JWT.
 */
export async function connectChatSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;

  const token = await getSessionCookieWithRetry();
  if (!token) {
    setStatus('error', 'Not signed in.');
    return null;
  }

  if (socket) {
    // An existing-but-disconnected instance: refresh the credential and let
    // socket.io reuse its own backoff rather than building a new client.
    socket.auth = { token };
    if (!socket.active) socket.connect();
    return socket;
  }

  setStatus('connecting');

  socket = io(`${env.apiOrigin}${CHAT_NAMESPACE}`, {
    // WebSocket only: the polling fallback would need the Cookie header we
    // cannot reliably set from RN, and the token is already in `auth`.
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  // Every `onChatSocketEvent` subscriber that registered before this
  // `Socket` existed — which is the common case, since callers subscribe on
  // mount and this `io(...)` call sits behind an async cookie read — needs
  // binding onto the object that only now exists. The object is never
  // replaced after this (see the `if (socket)` branch above), so this runs
  // exactly once per app session, not on every reconnect.
  serverListeners.forEach(({ event, handler }) => socket?.on(event, handler as never));

  socket.on('connect', () => {
    setStatus('connected');
    authFailureStreak = 0;
    // The server's room membership died with whatever connection came
    // before this one (the first one, or the one that just dropped) — every
    // registered room needs rejoining, not just the ones opened for the
    // first time.
    joinedRooms.clear();
    void resumeAllRooms();
  });

  socket.io.on('reconnect_attempt', () => {
    setStatus('reconnecting');
    // Re-stamp the credential — the session may have been refreshed, and a
    // stale JWT is rejected at the handshake rather than at first use.
    void getSessionCookie().then((fresh) => {
      if (socket && fresh) socket.auth = { token: fresh };
    });
  });

  socket.on('disconnect', (reason) => {
    // Membership is per-connection — the next connect starts from zero and
    // `resumeAllRooms` is what repopulates it, not a guess that the server
    // remembers.
    joinedRooms.clear();
    // `io client disconnect` is our own teardown, not a fault.
    if (reason === 'io client disconnect') setStatus('idle');
    else setStatus('reconnecting');
  });

  socket.on('connect_error', (err: Error) => {
    setStatus('error', err.message);
  });

  socket.on('error', (payload: { code?: string; message?: string }) => {
    // UNAUTHENTICATED / TOKEN_EXPIRED are followed by a server-side
    // disconnect and are the REST 401 path's problem, not a socket error to
    // surface twice.
    if (payload.code === 'UNAUTHENTICATED' || payload.code === 'TOKEN_EXPIRED') {
      setStatus('error', 'Your session has expired.');
      authFailureStreak += 1;

      // A bad credential does not become good by retrying in the next
      // second — that just hammers the gateway with the same rejection on
      // socket.io's fast default backoff. After a couple of straight
      // rejections, pause the automatic loop and try once more, slower,
      // with the cookie re-read right before that one attempt.
      if (authFailureStreak >= AUTH_FAILURE_STREAK_THRESHOLD && socket && !authBackoffTimer) {
        const active = socket;
        active.io.reconnection(false);
        authBackoffTimer = setTimeout(() => {
          authBackoffTimer = null;
          active.io.reconnection(true);
          void getSessionCookie().then((fresh) => {
            if (fresh) active.auth = { token: fresh };
            active.connect();
          });
        }, AUTH_FAILURE_BACKOFF_MS);
      }
      return;
    }
    authFailureStreak = 0;
    setStatus('error', payload.message ?? 'The chat service reported an error.');
  });

  return socket;
}

export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
  ownTurns.clear();
  rooms.clear();
  joinedRooms.clear();
  authFailureStreak = 0;
  if (authBackoffTimer) {
    clearTimeout(authBackoffTimer);
    authBackoffTimer = null;
  }
  setStatus('idle');
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function isChatSocketConnected(): boolean {
  return socket?.connected === true;
}

/* -------------------------------------------------------------------------- */
/* Own-turn bookkeeping                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Message ids this device started. `origin.socketId` routing means deltas
 * for a turn are sent only to the connection that asked for it — another
 * device sees `message:created` and then silence until completion. Knowing
 * which turns are ours is what lets the UI show a Stop button for our own
 * generation and a polled "still working" state for someone else's.
 */
const ownTurns = new Set<string>();

export function noteOwnTurn(messageId: string): void {
  ownTurns.add(messageId);
}

/** Hop two of the correlation chain: an assistant turn answering one of
 * ours is ours as well, even though nothing told us its id in advance. Use
 * this for an incoming `message:pending` rather than marking every pending
 * frame as owned — a broadcast pending frame for someone ELSE's HTTP-sent
 * turn is not ours just because it landed on our socket too. */
export function noteOwnReply(messageId: string, replyToId: string | null): void {
  if (replyToId !== null && ownTurns.has(replyToId)) {
    noteOwnTurn(messageId);
  }
}

export function ownsTurn(messageId: string): boolean {
  return ownTurns.has(messageId);
}

export function forgetTurn(messageId: string): void {
  ownTurns.delete(messageId);
}

/* -------------------------------------------------------------------------- */
/* Emitting                                                                    */
/* -------------------------------------------------------------------------- */

/** Distinguishes "the server refused" from "the server never answered".
 * They need different handling: a refusal is final, silence means the send
 * may not have happened and the HTTP fallback should carry it. */
export class ChatAckTimeout extends Error {
  constructor() {
    super('The chat service did not acknowledge that in time.');
    this.name = 'ChatAckTimeout';
  }
}

function emitWithAck<T>(event: string, payload: unknown): Promise<ChatAck<T>> {
  return new Promise((resolve, reject) => {
    const active = socket;
    if (!active?.connected) {
      reject(new ChatAckTimeout());
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new ChatAckTimeout());
    }, ACK_TIMEOUT_MS);

    active.emit(event, payload, (ack: ChatAck<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

export function joinConversation(conversationId: string) {
  return emitWithAck<{ conversationId: string; currentSequence: number }>('conversation:join', {
    conversationId,
  });
}

export function leaveConversation(conversationId: string) {
  return emitWithAck<{ conversationId: string }>('conversation:leave', { conversationId });
}

export function sendSocketMessage(payload: SocketSendPayload) {
  return emitWithAck<SocketSendAck>('message:send', payload);
}

/** There is NO REST equivalent — cancelling genuinely requires the live
 * connection, which is why the Stop button is disabled while it is down. */
export function cancelGeneration(messageId: string) {
  return emitWithAck<{ messageId: string }>('message:cancel', { messageId });
}

export function resumeConversation(conversationId: string, lastSequence: number) {
  return emitWithAck<ResumeAck>('connection:resume', { conversationId, lastSequence });
}

/** Note the casing: the SOCKET spells it `uptoSequence` while the REST body
 * spells it `upToSequence`. Both are real; this is not a typo. */
export function markReadOverSocket(conversationId: string, uptoSequence: number) {
  return emitWithAck<{ uptoSequence: number }>('message:read', { conversationId, uptoSequence });
}

/** Typing is not rate-limited server-side (the 5s key TTL is the control),
 * but it is still debounced client-side — see TYPING_IDLE_MS. Fire and
 * forget: a dropped typing frame is not worth a retry. */
export function emitTypingStart(conversationId: string): void {
  socket?.emit('typing:start', { conversationId });
}

export function emitTypingStop(conversationId: string): void {
  socket?.emit('typing:stop', { conversationId });
}
