/**
 * Customers CSV import — the wire contract, ported verbatim from the web
 * app's `src/types/customerImport.types.ts` (confirmed against that
 * source). Unlike `customers.types.ts`, nothing here is mapped to a
 * separate UI shape: the backend stores pence and the customer table
 * renders pounds, but an import job's counts are just counts, its
 * timestamps are already ISO strings, and its `percent` is already a
 * percentage. A mapping layer here would be a second place for the
 * contract to drift, so these wire types ARE the UI types.
 *
 * Three calls, in this order:
 *   1. POST /customers/import/upload       -> multipart; returns jobId, 202
 *   2. GET  /customers/import/{jobId}      -> poll
 *   3. POST /customers/import/{jobId}/apply -> confirm, then poll again
 * Plus two reads for a file that failed: `/{jobId}/errors` (paginated) and
 * `/{jobId}/errors/download` (a short-lived link to the full CSV report).
 */

/**
 * The job lifecycle. Terminal: `VALIDATION_FAILED`, `COMPLETED`, `FAILED`,
 * `EXPIRED`. `READY_TO_IMPORT` is a resting state, not a terminal one — it
 * waits for a human to confirm, and expires if nobody does.
 */
export type CustomerImportStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VALIDATION_FAILED'
  | 'READY_TO_IMPORT'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

/** Why one ROW was rejected. Branch on this, never on `message`. Typed
 * with a `string` escape hatch so a code added on the backend still
 * renders as itself rather than crashing a lookup. */
export type CustomerImportErrorCode =
  | 'REQUIRED'
  | 'INVALID_EMAIL'
  | 'INVALID_VALUE'
  | 'MAX_LENGTH'
  | 'UNSUPPORTED_VALUE'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_IN_DATABASE'
  | 'INVALID_HEADER'
  | 'MALFORMED_ROW'
  | string;

/** Why the JOB failed, as opposed to why a row did — describes the file
 * or the infrastructure, and decides whether the answer is "try again"
 * or "send a different file". */
export type CustomerImportFailureCode =
  | 'UPLOAD_MISSING'
  | 'BLOB_NOT_FOUND'
  | 'ARTEFACT_MISSING'
  | 'FILE_TOO_LARGE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'EMPTY_FILE'
  | 'INVALID_HEADER'
  | 'STORAGE_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'CONFLICT_SINCE_VALIDATION'
  | 'COUNT_MISMATCH'
  | 'INTERNAL_ERROR'
  | 'EXPIRED'
  | string;

/** What the picked file may declare. The gateway accepts all three and
 * pins the stored blob to `text/csv` regardless. */
export type ImportContentType = 'text/csv' | 'application/vnd.ms-excel' | 'application/octet-stream';

/** What `/upload` and `/apply` answer: the job, and where it now is. */
export interface ImportJobAccepted {
  jobId: string;
  status: CustomerImportStatus;
}

export interface ImportProgress {
  /** Rows read and checked so far. Present on `validation`. */
  processedRows?: number;
  /** Rows written so far. Present on `import`, and it is also the resume point. */
  importedRows?: number;
  /** `null` until validation reaches the end of the file — a streaming
   * parser does not know the row count before EOF. Render "counting
   * rows…" rather than "0 of 0". */
  totalRows: number | null;
  /** `null` whenever `totalRows` is. Never a made-up number. */
  percent: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** One rejected row. `row` is 1-based over the file's data rows, header
 * excluded; `0` means a file-level problem. */
export interface ImportRowError {
  row: number;
  /** The CSV header's own spelling, not our field name. */
  field: string;
  code: CustomerImportErrorCode;
  message: string;
}

export interface ImportErrorSummary {
  /** Exact, even when only the first 1,000 problems were stored. */
  totalErrors: number;
  /** True when more errors existed than were kept. `totalErrors` is still exact. */
  truncated: boolean;
  byCode: Record<string, number>;
  /** At most 10 — the rest come from `/errors` or the downloadable report. */
  firstErrors: ImportRowError[];
}

/** An earlier COMPLETED import of the same bytes. Advisory: warn, never block. */
export interface ImportDuplicateOf {
  jobId: string;
  completedAt: string | null;
  importedRows: number;
}

export interface ImportJob {
  jobId: string;
  status: CustomerImportStatus;
  originalFileName: string;
  fileSizeBytes: number | null;
  createdAt: string;
  validation: ImportProgress;
  /** The write phase. */
  import: ImportProgress;
  errorSummary: ImportErrorSummary;
  /** Whether apply is allowed, computed by the server from the status.
   * Do not re-derive this from `status` — the apply button reads this
   * field and nothing else. */
  canApply: boolean;
  failureCode: CustomerImportFailureCode | null;
  failureReason: string | null;
  expiresAt: string;
  duplicateOf?: ImportDuplicateOf | null;
}

export interface ImportErrorPageMeta {
  page: number;
  pageSize: number;
  total: number;
  truncated: boolean;
  /** How many errors this job was willing to store before it stopped keeping them. */
  collectedLimit: number;
}

export interface ImportErrorPage {
  items: ImportRowError[];
  meta: ImportErrorPageMeta;
}

export interface ListImportErrorsRequest {
  jobId: string;
  page?: number;
  pageSize?: number;
}

/** A read link to the full CSV report, valid for a few minutes. */
export interface ImportErrorReportUrl {
  url: string;
  expiresAt: string;
  format: 'csv';
}

/** A row of `GET /customers/import` — the recovery list: an import runs
 * on the server, so closing the app does not stop it, and this is how
 * the job is found again afterwards. */
export interface ImportJobListItem {
  jobId: string;
  status: CustomerImportStatus;
  originalFileName: string;
  totalRows: number | null;
  importedRows: number;
  invalidRows: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ImportJobListWire {
  items: ImportJobListItem[];
}
