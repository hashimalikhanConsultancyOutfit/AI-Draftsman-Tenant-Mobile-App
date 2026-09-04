/**
 * Knowledge bases — pure logic, ported from the web app's
 * `KnowledgeBases.data.ts` and `useKnowledgeBases.tsx`. Scope is a SECURITY
 * BOUNDARY, not a filing label — a customer-scoped base is unreachable by
 * any other customer's clone, which is why widening it is warned about and
 * narrowing it is not.
 */

import type { IconName } from '@/components/ui';
import type { KbFreshness, KbScope, KnowledgeBaseDocument, KnowledgeBaseDocumentSource, KnowledgeBaseIndexStatus } from './knowledgeBases.types';

export const SCOPE_OPTIONS: Array<{ label: string; value: KbScope }> = [
  { label: 'Customer', value: 'Customer' },
  { label: 'Agent', value: 'Agent' },
  { label: 'Internal', value: 'Internal' },
];

/** How wide each scope is. Widening (an increase in rank) is the dangerous
 * direction — it exposes documents to readers who could not see them a
 * moment ago. Narrowing is safe. */
export const SCOPE_RANK: Record<KbScope, number> = { Customer: 0, Agent: 1, Internal: 2 };

export const isWideningScope = (from: KbScope, to: KbScope): boolean => SCOPE_RANK[to] > SCOPE_RANK[from];

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const FRESHNESS_TONE: Record<KbFreshness, StatusTone> = { fresh: 'success', stale: 'warning', empty: 'neutral' };

export const FRESHNESS_LABEL: Record<KbFreshness, string> = { fresh: 'Fresh', stale: 'Stale', empty: 'Empty' };

export const FRESHNESS_HINT: Record<KbFreshness, string> = {
  fresh: 'Indexed recently — agents are answering from current documents.',
  stale: 'The index is behind the source. Reindex before relying on answers.',
  empty: 'No documents. Agents pointed at this base have nothing to cite.',
};

/** Who can read a base — stated as a sentence, because "Customer" in a chip
 * does not tell anyone the isolation is enforced. */
export const buildReachSummary = (scope: KbScope, scopeId: string): string => {
  if (scope === 'Internal') return 'Readable by every agent and every customer clone in this workspace.';
  if (scope === 'Agent') return `Readable by clones of ${scopeId || 'the scoped agent'}, across every customer.`;
  return `Readable only by ${scopeId || 'the scoped customer'}'s clones. No other customer's clone can reach it.`;
};

export const buildWideningWarning = (name: string, from: KbScope, to: KbScope): string =>
  `${name} widened from ${from} to ${to} — more agents can now read these documents. Anything customer-specific in this base is no longer isolated to one customer.`;

/** Deleting a base is not one delete: the documents exist on four surfaces
 * and all four have to go, or a "deleted" base keeps answering from a cache. */
export const buildPurgeWarning = (name: string, docs: number): string =>
  `Deleting ${name} purges four surfaces: the ${docs} indexed document${docs === 1 ? '' : 's'} and their vectors, the stored source files, any cached retrieval buffers still holding chunks, and the audit references pointing at them. Agents currently citing this base will start answering without it. This cannot be undone.`;

export const buildPurgeReceipt = (name: string, docs: number): string =>
  `${name} purged — ${docs} document${docs === 1 ? '' : 's'} and vectors removed, source files deleted, cached buffers dropped, audit references detached.`;

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export const SOURCE_LABEL: Record<KnowledgeBaseDocumentSource, string> = { UPLOAD: 'Upload', CRAWL: 'Link' };

/** How each indexing state reads, and in what tone. "Indexed" becomes
 * "Searchable" — the question that matters is whether an agent can answer
 * from the file yet, not the indexer's own vocabulary. */
export const INDEX_STATUS_COPY: Record<KnowledgeBaseIndexStatus, { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Queued', tone: 'info' },
  RUNNING: { label: 'Indexing…', tone: 'info' },
  INDEXED: { label: 'Searchable', tone: 'success' },
  QUARANTINED: { label: 'Quarantined', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'error' },
  UNKNOWN: { label: 'Unconfirmed', tone: 'warning' },
};

/** Null status is "never indexed", NOT an error — the honest state for a
 * public link and for anything registered while the indexer was unreachable. */
export const NOT_INDEXED_COPY: { label: string; tone: StatusTone } = { label: 'Not indexed', tone: 'neutral' };

export const documentStatusCopy = (status: KnowledgeBaseIndexStatus | null): { label: string; tone: StatusTone } =>
  status ? (INDEX_STATUS_COPY[status] ?? { label: status, tone: 'neutral' }) : NOT_INDEXED_COPY;

export const DOCUMENT_ICON: Record<KnowledgeBaseDocumentSource, IconName> = { UPLOAD: 'description', CRAWL: 'link' };

export const buildDocumentDeleteWarning = (document: KnowledgeBaseDocument): string =>
  document.source === 'UPLOAD'
    ? `${document.filename} will be removed from this knowledge base and permanently deleted from blob storage.`
    : `${document.filename} will be removed from this knowledge base.`;

/* -------------------------------------------------------------------------- */
/* Upload validation — mirrors web's upload.ts, minus archive extraction     */
/* -------------------------------------------------------------------------- */

/** Web's "Add links" tab disables its own "Add another link" button once the
 * list reaches 25 rows (`UploadDocumentsModal.tsx`) — the backend itself has
 * no matching cap (`AddDocumentsDto.documents` has no `@ArrayMaxSize`), but
 * mobile's link form had no cap at all, so a very large paste-driven list
 * could grow well past what web ever lets a user build in one batch. */
export const MAX_UPLOAD_LINKS = 25;

export const MAX_KB_UPLOAD_BYTES = 15 * 1024 * 1024;

export const KB_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const uploadContentType = (filename: string, declaredType?: string | null): string => {
  const declared = (declaredType?.split(';')[0] ?? '').trim().toLowerCase();
  if (declared && KB_UPLOAD_MIME_TYPES.has(declared)) return declared;
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? declared ?? 'application/octet-stream';
};

export const validateUploadFile = (filename: string, sizeBytes: number, declaredType?: string | null): string | null => {
  if (sizeBytes <= 0) return 'The file is empty.';
  if (sizeBytes > MAX_KB_UPLOAD_BYTES) return `The file is larger than ${String(MAX_KB_UPLOAD_BYTES / 1024 / 1024)} MB.`;
  if (!KB_UPLOAD_MIME_TYPES.has(uploadContentType(filename, declaredType))) {
    return 'Unsupported type. Use PDF, text, CSV, JSON, an image, Word or Excel.';
  }
  return null;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/* -------------------------------------------------------------------------- */
/* Public links                                                              */
/* -------------------------------------------------------------------------- */

const isPrivateIpv4 = (host: string): boolean => {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [first = -1, second = -1] = parts;
  return first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first === 0;
};

const isPrivateIpv6 = (host: string): boolean =>
  host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'));

/** SSRF guard — a knowledge base's link sources are fetched server-side, so
 * a link pointed at a private address would let this form probe the
 * backend's own network. */
export const validatePublicLink = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return 'Use an http or https link.';
    if (url.username || url.password) return 'Links containing credentials are not allowed.';
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || isPrivateIpv4(host) || isPrivateIpv6(host)) {
      return 'Use a publicly accessible link, not a local or private address.';
    }
    return null;
  } catch {
    return 'Enter a valid public URL.';
  }
};

export const filenameFromLink = (value: string): string => {
  try {
    const url = new URL(value.trim());
    const lastPathPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
    return (lastPathPart || url.hostname).slice(0, 255);
  } catch {
    return value.slice(0, 255);
  }
};

/* -------------------------------------------------------------------------- */
/* Authorisation copy                                                        */
/* -------------------------------------------------------------------------- */

export const NO_MANAGE_MESSAGE = 'You do not have permission to create or edit knowledge bases.';
export const NO_UPLOAD_MESSAGE = 'You do not have permission to upload documents.';
export const NO_REINDEX_MESSAGE = 'You do not have permission to reindex knowledge bases.';
export const NO_DELETE_MESSAGE = 'You do not have permission to delete knowledge bases or documents.';
