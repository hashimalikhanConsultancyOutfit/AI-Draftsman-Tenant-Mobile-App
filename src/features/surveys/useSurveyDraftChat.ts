import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useToast } from '@/components/ui';
import { env } from '@/config/env';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { getSessionCookie } from '@/services/cookieAuth';

import { useLazyGetSurveyDraftChatHistoryQuery, useUploadSurveyDraftAttachmentMutation } from './surveysApi';
import type { SurveyDraftReply } from './surveys.types';
import {
  AI_COPY,
  DRAFT_CHAT_NAMESPACE,
  canSendDraft,
  historyToDrawerMessages,
  nextMessageId,
  toApiMessage,
  type DrawerAttachment,
  type DrawerMessage,
} from './surveysRules';

/** Same reconnect budget as web's `surveyDraftChatSocket`. */
const MAX_RECONNECT_ATTEMPTS = 8;

/**
 * "Generate with AI" — web's `useSurveyAiChatDrawer`. While the sheet is
 * open it:
 *  - restores the survey's persisted conversation (`GET :id/draft-chat`),
 *    and keeps the composer locked until that settles;
 *  - holds its OWN `/survey-draft-chat` socket (not the chat singleton),
 *    opened on open and torn down on close, authenticated the way this
 *    app's chat socket is — the session cookie's value as `auth.token`;
 *  - uploads each picked file straight away (`POST :id/draft-chat/
 *    attachments`), so Send is blocked only while one is still uploading;
 *  - sends the WHOLE thread, oldest first, on every `draft:send` — the
 *    server is stateless and re-derives its answer from it.
 * `draft:reply` with `COMPLETE` carries the draft the card offers.
 */
export function useSurveyDraftChat(surveyId: string, open: boolean) {
  const toast = useToast();
  const [messages, setMessages] = useState<DrawerMessage[]>([]);
  const [value, setValue] = useState('');
  const [staged, setStaged] = useState<DrawerAttachment[]>([]);
  const [awaiting, setAwaiting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [loadHistory] = useLazyGetSurveyDraftChatHistoryQuery();
  const [upload] = useUploadSurveyDraftAttachmentMutation();

  const pushError = useCallback((text?: string) => {
    setMessages((m) => [...m, { id: nextMessageId(), role: 'assistant', text: text || AI_COPY.errorReply, isError: true }]);
  }, []);

  /* History, fresh on every open. A failed read falls through to an empty
     thread rather than blocking the sheet — as on web. */
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setMessages([]);
    setStaged([]);
    setValue('');
    setAwaiting(false);
    setRestoring(true);
    loadHistory(surveyId, false)
      .unwrap()
      .then((rows) => {
        if (!cancelled) setMessages(historyToDrawerMessages(rows));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, surveyId, loadHistory]);

  /* The socket's whole lifetime is the sheet being open. */
  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    let socket: Socket | null = null;
    void (async () => {
      const token = await getSessionCookie();
      if (disposed) return;
      socket = io(`${env.apiOrigin}${DRAFT_CHAT_NAMESPACE}`, {
        transports: ['websocket'],
        ...(token ? { auth: { token } } : {}),
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 500,
        reconnectionDelayMax: 10_000,
      });
      socketRef.current = socket;
      socket.on('draft:reply', (payload: SurveyDraftReply) => {
        setAwaiting(false);
        setMessages((m) => [
          ...m,
          { id: nextMessageId(), role: 'assistant', text: payload.message, ...(payload.status === 'COMPLETE' && payload.schema ? { draft: payload.schema } : {}) },
        ]);
      });
      socket.on('draft:error', (payload: { message?: string }) => {
        setAwaiting(false);
        pushError(payload?.message);
      });
      /* Only resolves a send that is waiting — a connection hiccup before
         anything was asked is left to the next send. */
      socket.on('connect_error', (error: Error) => {
        setAwaiting((was) => {
          if (was) pushError(error.message);
          return false;
        });
      });
    })();
    return () => {
      disposed = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [open, pushError]);

  const attach = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const id = nextMessageId();
      setStaged((s) => [...s, { id, name: asset.name, status: 'uploading' }]);
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      upload({ id: surveyId, form })
        .unwrap()
        .then((res) => setStaged((s) => s.map((a) => (a.id === id ? { ...a, status: 'ready', blobUrl: res.blobUrl } : a))))
        .catch((err) => {
          setStaged((s) => s.map((a) => (a.id === id ? { ...a, status: 'error' } : a)));
          toast.show(getErrorMessage(err as never, AI_COPY.uploadFailed), { tone: 'error' });
        });
    }
  }, [surveyId, upload, toast]);

  const removeStaged = useCallback((id: string) => setStaged((s) => s.filter((a) => a.id !== id)), []);

  const canSend = canSendDraft(value, staged, awaiting, restoring);

  const send = useCallback(() => {
    if (!canSend) return;
    const user: DrawerMessage = { id: nextMessageId(), role: 'user', text: value.trim(), attachments: staged.filter((a) => a.status !== 'error') };
    const thread = [...messages, user];
    setMessages(thread);
    setValue('');
    setStaged([]);
    const socket = socketRef.current;
    if (!socket) {
      pushError();
      return;
    }
    setAwaiting(true);
    /* Socket.IO buffers an emit made mid-reconnect; `connect_error` above
       is what unsticks the composer if the connection never comes back. */
    socket.emit('draft:send', { surveyId, messages: thread.filter((m) => !m.isError).map(toApiMessage) });
  }, [canSend, value, staged, messages, surveyId, pushError]);

  return { messages, value, setValue, staged, attach, removeStaged, awaiting, restoring, canSend, send };
}
