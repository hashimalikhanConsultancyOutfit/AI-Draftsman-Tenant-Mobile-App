/**
 * Customers CSV import — rules and copy, ported near-verbatim from the
 * web app's `src/features/Customers/CustomerImport.data.ts` (confirmed
 * against that source). Everything the import screen needs that is not a
 * request: the ceilings, the phase mapping, the polling cadence, and one
 * sentence per failure code — kept out of the hook and the screen so the
 * rules are testable without mounting anything, and so they cannot
 * disagree about, say, how often to poll.
 *
 * The constants below mirror the backend's shared constants — they exist
 * to say "that file is 25 MB" before spending minutes uploading it, and
 * for nothing else; every one is enforced again server-side.
 */
import type { CustomerImportStatus, ImportJobListItem } from './customerImport.types';

/* -------------------------------------------------------------------------- */
/* The file                                                                   */
/* -------------------------------------------------------------------------- */

/** The six columns, in no particular order. `name` and `email` are required. */
export const IMPORT_CSV_HEADERS = ['external_id', 'name', 'email', 'quota_monthly', 'portal_access', 'show_quota'] as const;

/** The columns a file must have — `email` is one of them because a
 * billing address is mandatory on every registration path. A file
 * without the column is refused at the header rather than per row. */
export const IMPORT_REQUIRED_HEADERS = ['name', 'email'] as const;

/** What the two boolean columns accept. Listed only so the screen can
 * name them in its instructions — the server is what enforces them. */
export const IMPORT_BOOLEAN_TRUE = ['true', 'yes', 'y', '1'] as const;
export const IMPORT_BOOLEAN_FALSE = ['false', 'no', 'n', '0'] as const;

/** 25 MB. */
export const IMPORT_MAX_BYTES = 26_214_400;
export const IMPORT_MAX_ROWS = 50_000;

/** Bytes as something a person reads. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface PickedCsvFile {
  name: string;
  size: number;
  mimeType?: string | null;
}

/** What to declare for the chosen file to the gateway's DTO. The picker
 * reports whatever the OS associates with `.csv` — `text/csv` on iOS,
 * `application/vnd.ms-excel` when Excel owns the association on Android,
 * or nothing at all — so an unrecognised type becomes `text/csv`, which
 * is what the file is and what the stored blob is pinned to regardless. */
export function toImportContentType(mimeType: string | null | undefined): 'text/csv' | 'application/vnd.ms-excel' | 'application/octet-stream' {
  const declared = mimeType?.split(';')[0]?.trim().toLowerCase();
  if (declared === 'text/csv' || declared === 'application/vnd.ms-excel' || declared === 'application/octet-stream') return declared;
  return 'text/csv';
}

/** Reject a file already known to fail server-side. Returns the reason,
 * or `null` when there is nothing to say — every check here is
 * duplicated server-side; the point is to fail in the picker rather than
 * after a 25 MB upload over mobile data. */
export function checkChosenFile(file: PickedCsvFile): string | null {
  if (!/\.csv$/i.test(file.name)) {
    return 'That is not a .csv file. Export the sheet as CSV and choose it again.';
  }
  if (file.size === 0) {
    return 'That file is empty.';
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return `That file is ${formatFileSize(file.size)}, over the ${formatFileSize(IMPORT_MAX_BYTES)} ceiling. Split it and import the parts.`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Phases                                                                     */
/* -------------------------------------------------------------------------- */

/** What the screen is showing. Derived from the job's status, EXCEPT
 * `choose` and `uploading`, which happen before there is a job to ask
 * about. */
export type ImportPhase = 'choose' | 'uploading' | 'validating' | 'review' | 'invalid' | 'importing' | 'completed' | 'failed';

/** Status to phase. This mapping decides what is DRAWN, not what is
 * ALLOWED — whether apply may be pressed is `job.canApply`, computed by
 * the server. */
export function importPhaseOf(status: CustomerImportStatus): ImportPhase {
  switch (status) {
    case 'PENDING_UPLOAD':
      return 'uploading';
    case 'UPLOADED':
    case 'VALIDATING':
      return 'validating';
    case 'VALIDATION_FAILED':
      return 'invalid';
    case 'READY_TO_IMPORT':
      return 'review';
    case 'IMPORTING':
      return 'importing';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
    case 'EXPIRED':
    default:
      return 'failed';
  }
}

/** Statuses that stop the poller. `READY_TO_IMPORT` is included even
 * though the job is not finished — it is waiting on a person, and
 * polling a state only a tap can change returns nothing new. */
const POLL_STOPS_AT: readonly CustomerImportStatus[] = ['VALIDATION_FAILED', 'READY_TO_IMPORT', 'COMPLETED', 'FAILED', 'EXPIRED'];

export function isImportPollingDone(status: CustomerImportStatus): boolean {
  return POLL_STOPS_AT.includes(status);
}

export const POLL_VALIDATING_MS = 2_000;
export const POLL_IMPORTING_MS = 3_000;
/** After this long on one job, ease off — a big file is minutes of polling. */
export const POLL_BACKOFF_AFTER_MS = 60_000;
export const POLL_BACKOFF_MS = 6_000;

/** How often to ask, in milliseconds. `0` means stop — RTK Query reads it that way. */
export function importPollInterval(status: CustomerImportStatus | undefined, elapsedMs: number): number {
  if (!status || isImportPollingDone(status)) return 0;
  if (elapsedMs >= POLL_BACKOFF_AFTER_MS) return POLL_BACKOFF_MS;
  return status === 'IMPORTING' ? POLL_IMPORTING_MS : POLL_VALIDATING_MS;
}

/** Jobs worth offering to reopen. `PENDING_UPLOAD` is excluded: its
 * upload never completed and there is no way to finish it — that file
 * has to be chosen again, which is a new import, not a resumed one.
 * `COMPLETED`/`FAILED`/`EXPIRED` are excluded because they are over. */
const RESUMABLE: readonly CustomerImportStatus[] = ['UPLOADED', 'VALIDATING', 'READY_TO_IMPORT', 'IMPORTING', 'VALIDATION_FAILED'];

export function isResumableImport(job: ImportJobListItem): boolean {
  return RESUMABLE.includes(job.status);
}

/** A rejection about the FILE rather than about its rows — a
 * `VALIDATION_FAILED` job carries a `failureCode` only when no row was
 * ever read (empty file, unusable header, over the row limit, unparseable).
 * That job has no per-row report and zero counts; a row-level rejection
 * leaves `failureCode` null and has both. */
export function isFileLevelRejection(failureCode: string | null | undefined): boolean {
  return Boolean(failureCode);
}

/** Short status wording for the resume list. */
export const IMPORT_STATUS_LABEL: Record<CustomerImportStatus, string> = {
  PENDING_UPLOAD: 'waiting for the file',
  UPLOADED: 'queued',
  VALIDATING: 'checking',
  VALIDATION_FAILED: 'needs fixing',
  READY_TO_IMPORT: 'waiting for you to confirm',
  IMPORTING: 'importing',
  COMPLETED: 'imported',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

/* -------------------------------------------------------------------------- */
/* The instructional banner (verbatim)                                       */
/* -------------------------------------------------------------------------- */

export const IMPORT_INSTRUCTIONS =
  'Header row required. Columns: external_id, name, email, quota_monthly, portal_access, show_quota — name and email are required, on every row. A file without an email column is rejected before any row is checked. quota_monthly is a token allowance, left at the workspace default when blank. portal_access gives white-label portal access and show_quota lets them see their own quota; write true/yes/y/1 or false/no/n/0, and a blank cell means no access. Every row becomes a new customer: a row matching one you already have is rejected rather than updated.';

export const IMPORT_FILE_HINT = `Up to ${formatFileSize(IMPORT_MAX_BYTES)} and ${IMPORT_MAX_ROWS.toLocaleString('en-GB')} rows. The file is checked in full before anything is written, and you confirm before it is.`;

/* -------------------------------------------------------------------------- */
/* Error and failure copy                                                    */
/* -------------------------------------------------------------------------- */

/** Row-level codes, as a column heading would say them — the server also
 * sends a `message` per row, which is more specific and is what gets
 * rendered; this is for the by-code tally. */
export const IMPORT_ERROR_CODE_LABEL: Record<string, string> = {
  REQUIRED: 'missing a required value',
  INVALID_EMAIL: 'not a valid email address',
  INVALID_VALUE: 'not an accepted value',
  MAX_LENGTH: 'too long',
  UNSUPPORTED_VALUE: 'out of the supported range',
  DUPLICATE_IN_FILE: 'duplicated inside this file',
  DUPLICATE_IN_DATABASE: 'already registered in this workspace',
  INVALID_HEADER: 'a header-row problem',
  MALFORMED_ROW: 'a malformed row',
};

/** The by-code tally as one sentence, largest bucket first. */
export function buildErrorCodeSummary(byCode: Record<string, number>): string {
  const parts = Object.entries(byCode)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => `${count.toLocaleString('en-GB')} ${IMPORT_ERROR_CODE_LABEL[code] ?? code}`);
  return parts.length > 0 ? `${parts.join(', ')}.` : '';
}

/** Why the JOB stopped, as opposed to why a row was rejected — every
 * sentence ends with what to do next. */
export const IMPORT_FAILURE_COPY: Record<string, string> = {
  UPLOAD_MISSING: 'The file never arrived in storage, so there was nothing to check. Choose it again and re-upload.',
  BLOB_NOT_FOUND: 'The uploaded file was gone by the time checking started. Choose it again and re-upload.',
  ARTEFACT_MISSING: 'The checked copy of this file has been cleared, so there is nothing left to import. Upload the file again.',
  FILE_TOO_LARGE: `The file is over the ${formatFileSize(IMPORT_MAX_BYTES)} ceiling. Split it and import the parts.`,
  ROW_LIMIT_EXCEEDED: `The file has more than ${IMPORT_MAX_ROWS.toLocaleString('en-GB')} rows. Split it and import the parts.`,
  EMPTY_FILE: 'The file has a header row and no data rows underneath it. Nothing was imported.',
  INVALID_HEADER: `The header row could not be read, so no row was ever checked. It needs ${IMPORT_REQUIRED_HEADERS.join(' and ')} columns; the other four are optional.`,
  STORAGE_UNAVAILABLE: 'File storage could not be reached. Nothing was written — start the import again in a few minutes.',
  DATABASE_UNAVAILABLE: 'The database could not be reached. Anything already written is intact and correct; import the rest from a file with those rows removed.',
  CONFLICT_SINCE_VALIDATION: 'A customer matching one of these rows was registered after the file was checked, so the import stopped rather than write a record that conflicts with it. Import the file again — it is re-checked against the registry as it is now.',
  COUNT_MISMATCH: 'The import ended with a different number of rows than it set out to write, so it will not report a success it cannot prove. Check the registry before importing again.',
  INTERNAL_ERROR: 'The import stopped on an unexpected error. Nothing further was written.',
  EXPIRED: 'This import was not confirmed in time and has expired. Upload the file again.',
  MALFORMED_ROW: 'The file could not be read as CSV. Re-export it from the spreadsheet and try again.',
};

/** One sentence for a failed job — the server's own `failureReason` wins
 * when present, else the code-keyed copy, else a raw fallback so a
 * newly added code still says something. */
export function buildFailureMessage(failureCode: string | null, failureReason: string | null): string {
  if (failureReason && failureReason.trim().length > 0) return failureReason;
  if (failureCode && IMPORT_FAILURE_COPY[failureCode]) return IMPORT_FAILURE_COPY[failureCode];
  return failureCode ? `The import stopped (${failureCode}).` : 'The import stopped before it finished.';
}

/* -------------------------------------------------------------------------- */
/* Progress copy (verbatim formatters)                                       */
/* -------------------------------------------------------------------------- */

export function buildValidationProgressLabel(processedRows: number | undefined, totalRows: number | null): string {
  const done = (processedRows ?? 0).toLocaleString('en-GB');
  if (totalRows === null) {
    return processedRows && processedRows > 0 ? `Counting rows — ${done} read so far` : 'Counting rows…';
  }
  return `${done} of ${totalRows.toLocaleString('en-GB')} rows checked`;
}

export function buildImportProgressLabel(importedRows: number | undefined, totalRows: number | null): string {
  const done = (importedRows ?? 0).toLocaleString('en-GB');
  return totalRows === null ? `${done} customers registered` : `${done} of ${totalRows.toLocaleString('en-GB')} customers registered`;
}

/** It says "registered", not "created or updated" — the apply worker is insert-only. */
export function buildReadyMessage(totalRows: number | null): string {
  const rows = totalRows ?? 0;
  return `${rows.toLocaleString('en-GB')} row${rows === 1 ? '' : 's'} checked, every one of them valid. Nothing has been written yet — confirming registers ${rows === 1 ? 'it' : 'them all'} as new customers.`;
}

/** An import is all-or-nothing: no force flag, no partial apply, no
 * "skip the bad rows". */
export function buildInvalidMessage(totalErrors: number, totalRows: number | null): string {
  const problems = totalErrors.toLocaleString('en-GB');
  const scope = totalRows === null ? '' : ` across ${totalRows.toLocaleString('en-GB')} row${totalRows === 1 ? '' : 's'}`;
  return `${problems} problem${totalErrors === 1 ? '' : 's'}${scope}. Nothing was written — an import is all or nothing, so the file has to be corrected and uploaded again.`;
}

export function buildCompletedMessage(importedRows: number, fileName: string): string {
  return `${importedRows.toLocaleString('en-GB')} customer${importedRows === 1 ? '' : 's'} registered from ${fileName}. Every run they make from here is attributed to them.`;
}

/** `importedRows` on a FAILED job is not an estimate — the batches that
 * committed are real customers, written in the same transaction. */
export function buildPartialImportMessage(importedRows: number): string {
  return `${importedRows.toLocaleString('en-GB')} customer${importedRows === 1 ? '' : 's'} were registered before it stopped, and they are correct — they are in the registry now. Remove those rows from the file before importing the rest.`;
}

/** Advisory, never blocking — re-importing identical bytes is
 * legitimate (the first attempt may have failed midway, or those
 * customers may have been archived since). */
export function buildDuplicateWarning(completedAt: string | null, importedRows: number): string {
  const when = completedAt ? new Date(completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'earlier';
  return `An identical file was already imported ${completedAt ? `on ${when}` : when}, registering ${importedRows.toLocaleString('en-GB')} customer${importedRows === 1 ? '' : 's'}. Importing it again is allowed — every row is checked against the registry first, so anything already there will be rejected rather than duplicated.`;
}

/** Long dates, spelled out — an import expiry is not somewhere to be terse. */
export function formatImportMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Row 0 is not a row — the server uses it for a problem with the FILE,
 * and "Row 0" would send someone looking for a line that does not exist. */
export function importErrorRowLabel(row: number): string {
  return row === 0 ? 'File' : `Row ${row}`;
}
