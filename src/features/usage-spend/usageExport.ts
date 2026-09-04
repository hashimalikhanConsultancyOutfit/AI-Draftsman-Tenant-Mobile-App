/**
 * `POST /usage/export` — a synchronous CSV body, not JSON. Bypasses
 * `apiRequest`/the RTK Query `baseQuery` for the same reason
 * `csvUpload.ts` does: both only ever parse a JSON response (see
 * `httpClient.ts`'s `apiRequest` — anything not `application/json`
 * resolves to `undefined`), which would silently throw the CSV body
 * away. Session auth is cookie-based, so this attaches the same
 * `Cookie` header `apiRequest` builds, by hand, exactly as `csvUpload.ts`
 * already does for its own raw-fetch bypass.
 *
 * Mobile has no `expo-sharing`/`expo-file-system` dependency yet, so the
 * result is copied to the clipboard rather than saved or shared as a
 * file — see `ExportSheet.tsx` and the module spec for the full
 * reasoning. This is a deliberately real call against the one export
 * route the backend actually has (CSV, one period, fixed grouping — no
 * format/group/range choice); web's own export dialog offers all four
 * and calls none of them (`useUsageSpend.tsx`'s `handleSubmitExport`
 * only shows a toast), so there is nothing there to port faithfully.
 */
import { env } from '@/config/env';
import { buildCookieHeader } from '@/services/cookieAuth';

export class UsageExportError extends Error {}

export async function exportUsageCsv(period: string): Promise<string> {
  const cookieHeader = await buildCookieHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/usage/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/csv',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ period }),
    });
  } catch (cause) {
    throw new UsageExportError('Unable to reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    // The export route answers errors as JSON even though success is CSV.
    const body = await response.json().catch(() => undefined) as { message?: string | string[] } | undefined;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new UsageExportError(message?.trim() || `Could not export usage (HTTP ${String(response.status)}).`);
  }

  return response.text();
}
