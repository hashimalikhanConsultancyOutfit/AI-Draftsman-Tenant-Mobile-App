import { env } from '@/config/env';
import { buildCookieHeader } from './cookieAuth';

/**
 * Uploads attachment bytes to the URL an upload-intent reserved. Sibling to
 * `csvUpload.ts` and built the same way, for the same reason: neither
 * `fetch` nor an RTK Query mutation arg can report upload progress, and a
 * 25 MB attachment on an ordinary mobile connection is real time with
 * nothing to show for it otherwise. `XMLHttpRequest` is the one primitive
 * with `upload.onprogress` on RN.
 *
 * Session auth is the native cookie jar, exactly as `csvUpload.ts` and
 * `apiRequest` do it — this bypasses both, so it attaches the header itself.
 */

export class ChatUploadError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChatUploadError';
    this.status = status;
  }
}

export interface ChatUploadFile {
  /** `file://...` (or `content://` on Android) URI from the picker. */
  uri: string;
  name: string;
  type: string;
}

export interface ChatUploadOptions {
  /** `uploadPath` from the upload-intent response. May be a bare gateway
   * path (`/attachments/:id/content`) or, depending on how the backend
   * team ships it, already-absolute — both are handled. */
  uploadPath: string;
  file: ChatUploadFile;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const NETWORK_MESSAGE = 'The upload could not reach the server. Check your connection and try again.';
const ABORT_MESSAGE = 'The upload was cancelled.';

function resolveUploadUrl(uploadPath: string): string {
  if (uploadPath.startsWith('http://') || uploadPath.startsWith('https://')) return uploadPath;
  // `env.apiBaseUrl` already carries the `/api/v1` prefix; a path that
  // already starts with it should not get it twice.
  if (uploadPath.startsWith('/api/')) return `${env.apiOrigin}${uploadPath}`;
  return `${env.apiBaseUrl}${uploadPath.startsWith('/') ? '' : '/'}${uploadPath}`;
}

function readGatewayError(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
    const { message } = body;
    if (Array.isArray(message) && message.length > 0) return message.join(' ');
    if (typeof message === 'string' && message.trim().length > 0) return message;
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return 'Upload failed.';
}

/** POSTs `file` as multipart/form-data under field `file`, per the backend
 * contract. Resolves with the parsed JSON body — `{ id, status, ... }`. */
export function uploadChatAttachment<T = unknown>({
  uploadPath,
  file,
  onProgress,
  signal,
}: ChatUploadOptions): Promise<T> {
  if (signal?.aborted) return Promise.reject(new ChatUploadError(ABORT_MESSAGE, 0));

  return new Promise<T>((resolve, reject) => {
    void buildCookieHeader().then((cookieHeader) => {
      const body = new FormData();
      body.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', resolveUploadUrl(uploadPath), true);
      if (cookieHeader) xhr.setRequestHeader('Cookie', cookieHeader);
      // Content-Type is deliberately left unset — RN derives it (with the
      // multipart boundary) from the FormData; setting it by hand strips
      // the boundary and the server rejects the body as malformed.

      const onAbort = () => xhr.abort();
      signal?.addEventListener('abort', onAbort);
      const detach = () => signal?.removeEventListener('abort', onAbort);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          onProgress(event.lengthComputable && event.total > 0 ? Math.min(1, event.loaded / event.total) : 0);
        };
      }

      xhr.onload = () => {
        detach();
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new ChatUploadError(readGatewayError(xhr), xhr.status));
          return;
        }
        onProgress?.(1);
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ChatUploadError('The upload finished but the reply could not be read.', xhr.status));
        }
      };
      xhr.onerror = () => {
        detach();
        reject(new ChatUploadError(NETWORK_MESSAGE, 0));
      };
      xhr.onabort = () => {
        detach();
        reject(new ChatUploadError(ABORT_MESSAGE, 0));
      };
      xhr.ontimeout = () => {
        detach();
        reject(new ChatUploadError('The upload timed out.', 0));
      };

      xhr.send(body);
    });
  });
}
