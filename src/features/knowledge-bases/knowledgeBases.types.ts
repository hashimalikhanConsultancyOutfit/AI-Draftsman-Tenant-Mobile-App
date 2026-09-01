/**
 * Knowledge bases — types. Mirrors the web app's `src/types/knowledgeBase.types.ts`
 * and `src/store/api/knowledgeBases.api.ts`, trimmed to what this app builds:
 * the table/detail/CRUD/reindex/document-management flow. Archive (zip/rar)
 * auto-extraction on upload is desktop-only (JSZip + node-unrar-js) and is
 * deliberately out of scope here — a mobile upload is one file (or a batch
 * of individually-picked files) at a time.
 */

export type KbScope = 'Internal' | 'Agent' | 'Customer';

/** Index freshness. `empty` is distinct from `stale`: a stale base has
 * documents that need re-indexing, an empty one has nothing to serve. */
export type KbFreshness = 'fresh' | 'stale' | 'empty';

/** One place a base's documents come from. `id` is the server's, minted per
 * source and stable across saves that leave the URL alone. */
export interface KbSource {
  id: string;
  url: string;
}

/** A source on the way out, as the edit screen assembles it. `id` present on
 * a row seeded from the saved record, absent on one just typed. */
export interface KbSourceInput {
  id?: string;
  url: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  scope: KbScope;
  /** Agent or customer names the scope points at; empty for company-wide. */
  scopeId: string;
  agentIds: string[];
  agents: Array<{ id: string; name: string }>;
  sourceUrls: KbSource[];
  src: string;
  docs: number;
  /** Relative time of the last index run — "today", "3 days ago", "never". */
  idx: string;
  fresh: KbFreshness;
  creator?: { id: string; name: string | null } | null;
}

export interface KnowledgeBasePage {
  items: KnowledgeBase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListKnowledgeBasesArgs {
  page?: number;
  limit?: number;
}

export type KnowledgeBaseIndexStatus = 'QUEUED' | 'RUNNING' | 'INDEXED' | 'QUARANTINED' | 'FAILED' | 'UNKNOWN';

export type KnowledgeBaseDocumentSource = 'UPLOAD' | 'CRAWL';

export interface KnowledgeBaseDocument {
  id: string;
  /** Compact, copyable reference — not an address; fetch/delete by `id`. */
  hash: string;
  kbId: string;
  filename: string;
  source: KnowledgeBaseDocumentSource;
  blobUrl: string;
  indexedAt: string | null;
  indexStatus: KnowledgeBaseIndexStatus | null;
  indexReason: string | null;
  createdAt: string;
}

export interface KnowledgeBaseDocumentsPage {
  items: KnowledgeBaseDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListKnowledgeBaseDocumentsArgs {
  id: string;
  page?: number;
  limit?: number;
}

export interface CreateKnowledgeBaseArgs {
  name: string;
  scope: KbScope;
  agentIds: string[];
  sourceUrls: KbSourceInput[];
}

export interface UpdateKnowledgeBaseArgs {
  id: string;
  name: string;
  scope: KbScope;
  agentIds: string[];
  sourceUrls: KbSourceInput[];
}

export interface PresignedUploadCredential {
  uploadUrl: string;
  blobUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface CreateUploadIntentArgs {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface AddDocumentEntry {
  filename: string;
  blobUrl: string;
  source: KnowledgeBaseDocumentSource;
  contentType?: string;
}

export interface AddKnowledgeBaseDocumentsArgs {
  id: string;
  documents: AddDocumentEntry[];
}

export interface UpdateKnowledgeBaseDocumentArgs {
  id: string;
  documentId: string;
  filename?: string;
  blobUrl?: string;
  contentType?: string;
  contentReplaced?: boolean;
}

export interface DeleteKnowledgeBaseDocumentArgs {
  id: string;
  documentId: string;
}

export interface DeleteKnowledgeBaseDocumentResult {
  id: string;
  kbId: string;
  blobDeleted: boolean;
}
