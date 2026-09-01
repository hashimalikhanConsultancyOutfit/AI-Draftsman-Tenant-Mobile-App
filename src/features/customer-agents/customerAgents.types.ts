/**
 * Customer agents (clones) — types, ported from the web app's
 * `src/types/clone.types.ts` and `src/store/api/clones.api.ts` (confirmed
 * against that source AND against the live tenant portal on 2026-09-01 —
 * `GET /agents/customer-agents` was hit directly and its response shape
 * matches this file field for field).
 *
 * The wire shape and the UI shape are the same object here, unlike
 * `company-agents` — the clones endpoint already speaks the app's own
 * vocabulary (`cust`, `parent`, `div`, ...) rather than a gateway-internal
 * shape that needs translating, so there is no `toClone()` mapper.
 */

export type CloneState = 'in sync' | 'diverged' | 'pinned';

/**
 * A clone is a FULL INDEPENDENT COPY of a company agent, not a reference to
 * one. Editing a clone never reaches back into its master, and deleting the
 * master leaves the clone running — orphaned, but functional.
 *
 * `prompt`/`model`/`tools` are the clone's own copy of the definition and
 * are optional: absent means "whatever the master says", and the first save
 * writes explicit values. `div` is then derived by comparing those values
 * against the master's — never accumulated as the user edits.
 */
export interface Clone {
  id: string;
  /** Customer name this clone belongs to. */
  cust: string;
  /** Name of the master agent it was cloned from. */
  parent: string;
  /** Version of the master this clone is on. */
  ver: number;
  /** Fields the customer has locally overridden. Derived, never appended to. */
  div: string[];
  state: CloneState;
  /** Spend attributed to this clone, in GBP. */
  spend: number;
  /** Pinned clones are excluded from master pushes. */
  pinned: boolean;
  prompt?: string;
  model?: string;
  tools?: string;
}

/** One page of the tenant's clones — `GET /agents/customer-agents` return shape. */
export interface CustomerAgentsPage {
  items: Clone[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListCustomerAgentsArgs {
  page?: number;
  limit?: number;
}

/** What a clone edit may carry, in the app's own vocabulary. `div` and
 * `state` are never sent — both are derived server-side on every save. */
export interface UpdateCloneArgs {
  id: string;
  prompt?: string;
  model?: string;
  /** Comma-separated, as the form holds it. Split before it goes on the wire. */
  tools?: string;
  note?: string;
  /** The master version this copy now holds. Sent only by the push apply
   * and its undo. */
  ver?: number;
}

export interface RecloneCloneArgs {
  id: string;
  note?: string;
}

export interface PinCloneArgs {
  id: string;
  pinned: boolean;
}

/** The clone edit response: the row, plus what the write did to it. */
export interface UpdatedClone extends Clone {
  definitionInvalidated?: boolean;
  version: number | null;
}

/** The three definition fields a customer may override on their clone. */
export interface CloneDefinition {
  prompt: string;
  model: string;
  tools: string;
}

/** The four tabs. `push` is a control panel, not a filtered list. */
export type CloneTab = 'all' | 'diverged' | 'pinned' | 'push';

/**
 * The four outcomes a push can have for one clone.
 *  - `clean`    no local changes; takes the new version outright
 *  - `merge`    exactly one local change; master merges around it
 *  - `conflict` two or more local changes; skipped or overwritten by mode
 *  - `pinned`   pinned; skipped unless locked fields are forced on
 */
export type PushBucket = 'clean' | 'merge' | 'conflict' | 'pinned';

/** How the operator wants the awkward cases handled. */
export interface PushOptions {
  conflictMode: 'skip' | 'overwrite';
  /** The only thing that lets a push touch a pinned clone. */
  forcePinned: boolean;
}

/** One clone's place in a planned push. */
export interface PushPlanEntry {
  cloneId: string;
  customer: string;
  fromVersion: number;
  divergedFields: string[];
  bucket: PushBucket;
  /** True when this push will actually write to the clone. */
  willApply: boolean;
  reason: string;
}

/** The whole plan. Rendered as a preview, then executed verbatim. */
export interface PushPlan {
  masterName: string;
  toVersion: number;
  entries: PushPlanEntry[];
  counts: Record<PushBucket, number>;
  applyCount: number;
}

/** A completed push, retained (for this screen session only) so it can be
 * undone. */
export interface PushHistoryRecord {
  id: string;
  masterName: string;
  toVersion: number;
  at: number;
  previous: Clone[];
}

/** One row of the clone detail screen's field comparison table. */
export interface CloneFieldRow {
  id: string;
  label: string;
  /** What this customer's copy holds. */
  value: string;
  /** The master's current value for the same field. Absent on rows that
   * are facts about the copy rather than definition fields. */
  masterValue?: string;
  /** Read from the server's `div`, not recomputed here — that list is what
   * decides whether a push will overwrite this field. */
  isDiverged?: boolean;
  moneyAmount?: number;
}
