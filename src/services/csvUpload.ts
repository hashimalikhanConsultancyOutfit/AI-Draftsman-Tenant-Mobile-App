import { env } from '@/config/env';
import { buildCookieHeader } from './cookieAuth';

/**
 * CSV upload — multipart to our own gateway, with progress. Ported from
 * the web app's `src/lib/csvUpload.ts`. One `multipart/form-data` POST of
 * a file to a gateway route, reporting upload progress as it goes.
 * Resolves with the parsed JSON body.
 *
 * Not routed through `apiRequest`/the RTK Query `baseQuery` for the same
 * reason web keeps it out of `fetchBaseQuery`: neither `fetch` nor RTK
 * Query's mutation args can report upload progress, and a 25 MB file on
 * an ordinary mobile connection is tens of seconds of silence — a bar
 * that cannot move is worse than no bar. `XMLHttpRequest` is the one
 * primitive with `upload.onprogress`, on RN exactly as in a browser.
 *
 * Session auth: this app is cookie-based, not bearer-token (see
 * cookieAuth.ts) — `apiRequest` attaches the `Cookie` header itself on
 * every request via `buildCookieHeader()`, and this helper does the same
 * by hand since it bypasses `apiRequest` entirely.
 */

/** Thrown by `uploadCsvFile`. `status` is 0 when there was no response at all. */
export class CsvUploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CsvUploadError';
    this.status = status;
  }
}

export interface CsvUploadFile {
  /** `file://...` (or content://) URI from expo-document-picker. */
  uri: string;
  name: string;
  type: string;
}

export interface CsvUploadOptions {
  /** Absolute URL of the gateway route. */
  url: string;
  /** The form field name the route reads. */
  field: string;
  file: CsvUploadFile;
  /**
   * Called with 0-100, or `null` when the total cannot be computed.
   * Fires on every progress event, so throttle in the consumer if it renders.
   */
  onProgress?: (percent: number | null) => void;
  /** Aborts the upload. The promise then rejects with status 0. */
  signal?: AbortSignal;
}

const NETWORK_MESSAGE = 'The upload could not reach the server. Check your connection and try again.';
const ABORT_MESSAGE = 'The upload was cancelled.';

/** Read whatever the gateway said. Nest's exception filter answers
 * `{ statusCode, message, error }`, and `message` is written for a
 * person — it can also be an array when a validation pipe rejected the
 * body, hence the join rather than a raw stringify. */
function readGatewayError(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
    const { message } = body;
    if (Array.isArray(message) && message.length > 0) return message.join(' ');
    if (typeof message === 'string' && message.trim().length > 0) return message;
  } catch {
    // Not JSON — a proxy error page, or an empty body. Fall through.
  }
  return `The upload was rejected (HTTP ${String(xhr.status)}).`;
}

/**
 * POST `file` to `url` as multipart. Resolves with the parsed JSON body on 2xx.
 *
 * No retry: the caller decides, because a retry here would re-upload the
 * whole file and create a second import job for it.
 */
export async function uploadCsvFile<T = unknown>({ url, field, file, onProgress, signal }: CsvUploadOptions): Promise<T> {
  if (signal?.aborted) {
    throw new CsvUploadError(ABORT_MESSAGE, 0);
  }

  const cookieHeader = await buildCookieHeader();

  return new Promise<T>((resolve, reject) => {
    const body = new FormData();
    // RN's FormData reads this {uri, name, type} shape specially and
    // streams the file from disk — there is no `Blob`/`File` to wrap it
    // in first, unlike the web version.
    body.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (cookieHeader) {
      xhr.setRequestHeader('Cookie', cookieHeader);
    }
    // Content-Type is deliberately NOT set by hand — RN sets it from the
    // FormData, with the multipart boundary; overriding it here produces
    // a boundary-less header and the server rejects the body as malformed.

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener('abort', onAbort);
    const detach = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        onProgress(event.lengthComputable && event.total > 0 ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : null);
      };
    }

    xhr.onload = () => {
      detach();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new CsvUploadError(readGatewayError(xhr), xhr.status));
        return;
      }
      onProgress?.(100);
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch {
        reject(new CsvUploadError('The upload finished but the server’s reply could not be read.', xhr.status));
      }
    };

    xhr.onerror = () => {
      detach();
      reject(new CsvUploadError(NETWORK_MESSAGE, 0));
    };

    xhr.onabort = () => {
      detach();
      reject(new CsvUploadError(ABORT_MESSAGE, 0));
    };

    xhr.ontimeout = () => {
      detach();
      reject(new CsvUploadError('The upload timed out.', 0));
    };

    xhr.send(body);
  });
}

/** The upload route. `env.apiBaseUrl` already carries the gateway's `/api/v1` prefix. */
export const IMPORT_UPLOAD_URL = `${env.apiBaseUrl}/customers/import/upload`;
export const IMPORT_FILE_FIELD = 'file';

export default uploadCsvFile;
