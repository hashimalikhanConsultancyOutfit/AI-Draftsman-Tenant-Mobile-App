import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { uploadChatAttachment } from '@/services/chatAttachmentUpload';

import type { AttachmentKind, ComposerAttachment } from './chat.types';
import {
  ATTACHMENT_LIMIT_REACHED,
  ATTACHMENT_TOO_LARGE,
  ATTACHMENT_UPLOAD_FAILED,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
} from './chatRules';
import { useCreateAttachmentIntentMutation, useDeleteAttachmentMutation } from './chatApi';

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `composer-attachment-${localIdCounter}`;
}

/**
 * Owns the composer's pending-attachment tray: picking, uploading with
 * progress, retry, and removal. Upload starts at SELECTION, not at send —
 * exactly as the web does it — so by the time the user taps Send every
 * ready attachment is already just an id.
 *
 * Each in-flight upload gets its own AbortController so removing a chip
 * mid-upload actually cancels the network request rather than merely
 * hiding it.
 */
export function useComposerAttachments(conversationId: string) {
  const toast = useToast();
  const [items, setItems] = useState<ComposerAttachment[]>([]);
  const [createIntent] = useCreateAttachmentIntentMutation();
  const [deleteAttachment] = useDeleteAttachmentMutation();
  const controllers = useRef<Map<string, AbortController>>(new Map());

  const readyIds = useCallback(() => items.filter((a) => a.state === 'ready' && a.attachmentId).map((a) => a.attachmentId as string), [items]);

  const isUploading = items.some((a) => a.state === 'uploading');

  const runUpload = useCallback(
    async (localId: string, args: { uri: string; filename: string; mimeType: string; sizeBytes: number; kind: AttachmentKind }) => {
      const controller = new AbortController();
      controllers.current.set(localId, controller);

      try {
        const intent = await createIntent({
          conversationId,
          kind: args.kind,
          filename: args.filename,
          mimeType: args.mimeType,
          sizeBytes: args.sizeBytes,
        }).unwrap();

        setItems((prev) =>
          prev.map((a) => (a.localId === localId ? { ...a, attachmentId: intent.attachmentId } : a)),
        );

        await uploadChatAttachment({
          uploadPath: intent.uploadPath,
          file: { uri: args.uri, name: args.filename, type: args.mimeType },
          signal: controller.signal,
          onProgress: (fraction) => {
            setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, progress: fraction } : a)));
          },
        });

        // Held at 100% briefly so the bar visibly finishes rather than
        // jump-cutting straight to the ready state.
        setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, progress: 1 } : a)));
        await new Promise((resolve) => setTimeout(resolve, 600));
        setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, state: 'ready' } : a)));
      } catch (err) {
        if (controller.signal.aborted) return; // removed mid-upload — nothing to report
        const message = err instanceof Error ? err.message : ATTACHMENT_UPLOAD_FAILED;
        setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, state: 'failed', error: message } : a)));
      } finally {
        controllers.current.delete(localId);
      }
    },
    [conversationId, createIntent],
  );

  const addFiles = useCallback(
    (files: Array<{ uri: string; filename: string; mimeType: string; sizeBytes: number; kind: AttachmentKind }>) => {
      setItems((prev) => {
        const room = MAX_ATTACHMENTS_PER_MESSAGE - prev.length;
        if (room <= 0) {
          toast.show(ATTACHMENT_LIMIT_REACHED, { tone: 'warning' });
          return prev;
        }

        const accepted: typeof files = [];
        for (const file of files) {
          if (file.sizeBytes > MAX_ATTACHMENT_BYTES) {
            toast.show(ATTACHMENT_TOO_LARGE(file.filename), { tone: 'warning' });
            continue;
          }
          if (accepted.length >= room) {
            toast.show(ATTACHMENT_LIMIT_REACHED, { tone: 'warning' });
            break;
          }
          accepted.push(file);
        }
        if (accepted.length === 0) return prev;

        const newItems: ComposerAttachment[] = accepted.map((file) => ({
          localId: nextLocalId(),
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          kind: file.kind,
          uri: file.uri,
          state: 'uploading',
          progress: 0,
          attachmentId: null,
          error: null,
        }));

        for (let i = 0; i < newItems.length; i += 1) {
          const item = newItems[i];
          const source = accepted[i];
          if (item && source) void runUpload(item.localId, source);
        }

        return [...prev, ...newItems];
      });
    },
    [runUpload, toast],
  );

  const pickFiles = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (result.canceled) return;
    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        filename: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: asset.size ?? 0,
        kind: 'FILE' as const,
      })),
    );
  }, [addFiles]);

  const pickPhotos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        filename: asset.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        sizeBytes: asset.fileSize ?? 0,
        kind: 'PHOTO' as const,
      })),
    );
  }, [addFiles]);

  const pickVideos = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        filename: asset.fileName ?? `video-${Date.now()}.mp4`,
        mimeType: asset.mimeType ?? 'video/mp4',
        sizeBytes: asset.fileSize ?? 0,
        kind: 'VIDEO' as const,
      })),
    );
  }, [addFiles]);

  const remove = useCallback(
    (localId: string) => {
      const controller = controllers.current.get(localId);
      controller?.abort();

      setItems((prev) => {
        const target = prev.find((a) => a.localId === localId);
        // An already-reserved attachment must be released, or it sits
        // untouched until the backend's 24h reaper — worth cleaning up
        // immediately rather than waiting on that.
        if (target?.attachmentId && target.state !== 'ready') {
          void deleteAttachment(target.attachmentId).catch(() => undefined);
        } else if (target?.attachmentId && target.state === 'ready') {
          void deleteAttachment(target.attachmentId).catch(() => undefined);
        }
        return prev.filter((a) => a.localId !== localId);
      });
    },
    [deleteAttachment],
  );

  const retry = useCallback(
    (localId: string) => {
      const target = items.find((a) => a.localId === localId);
      if (!target) return;
      setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, state: 'uploading', progress: 0, error: null } : a)));
      void runUpload(localId, {
        uri: target.uri,
        filename: target.filename,
        mimeType: target.mimeType,
        sizeBytes: target.sizeBytes,
        kind: target.kind,
      });
    },
    [items, runUpload],
  );

  const clear = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    setItems([]);
  }, []);

  return { items, isUploading, readyIds, pickFiles, pickPhotos, pickVideos, remove, retry, clear };
}
