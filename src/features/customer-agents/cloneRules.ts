/**
 * Customer agents (clones) — pure business rules, ported from the web app's
 * `CustomerAgents.data.ts` / `useCustomerAgents.tsx` (confirmed against that
 * source, and live-tested against the actual tenant portal, on 2026-09-01).
 *
 * Two of these matter more than the rest:
 *
 *  recomputeDivergence  Divergence is DERIVED on every save by comparing the
 *                       clone against its master. It is never a flag that
 *                       gets set and left — edit a field back to the
 *                       master's value and it stops being divergent.
 *
 *  planPush             The push planner. The preview screen renders this
 *                       and the apply iterates the very same object, so the
 *                       two cannot drift.
 */

import type { Agent } from '@/features/company-agents/companyAgents.types';

import type {
  Clone,
  CloneDefinition,
  CloneFieldRow,
  CloneState,
  CloneTab,
  PushBucket,
  PushOptions,
  PushPlan,
  PushPlanEntry,
} from './customerAgents.types';

/** The three overridable fields, and the labels divergence is recorded
 * under — the label strings are the contract with the stored data. */
export const CLONE_DEFINITION_FIELDS = [
  { key: 'prompt', label: 'system prompt' },
  { key: 'model', label: 'model' },
  { key: 'tools', label: 'tools' },
] as const;

export type CloneDefinitionKey = (typeof CLONE_DEFINITION_FIELDS)[number]['key'];

/** Rows per page on the All clones tab — matches the web app's `DEFAULT_LIMIT`. */
export const CLONES_LIST_PAGE_SIZE = 10;

/** How much of a system prompt the comparison table shows inline — matches
 * web's own truncation, so "This copy" and "Master" stay the same length
 * and stay comparable at a glance. The field's copy-to-clipboard action
 * (on the detail screen) still copies the untruncated text. */
const CLONE_PROMPT_PREVIEW_LENGTH = 140;

export function truncateClonePrompt(prompt: string): string {
  if (!prompt) return '—';
  return prompt.length <= CLONE_PROMPT_PREVIEW_LENGTH ? prompt : `${prompt.slice(0, CLONE_PROMPT_PREVIEW_LENGTH)}…`;
}

/** How long a push can be rolled back for. */
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Share of clones a staged rollout reaches first. */
export const STAGED_ROLLOUT_PERCENT = 10;

/** Badge tone per clone state. */
export const CLONE_STATE_TONE: Record<CloneState, 'success' | 'warning' | 'info'> = {
  'in sync': 'success',
  diverged: 'warning',
  pinned: 'info',
};

/** How each push bucket is titled and explained. */
export const PUSH_BUCKET_COPY: Record<PushBucket, { title: string; description: string; tone: 'success' | 'info' | 'error' | 'warning' }> = {
  clean: {
    title: 'Clean update',
    description: 'No local changes. These take the new version exactly as published.',
    tone: 'success',
  },
  merge: {
    title: 'Field merge',
    description: 'One locally-changed field. The master merges around it and the local change is kept.',
    tone: 'info',
  },
  conflict: {
    title: 'Conflict',
    description: 'Two or more locally-changed fields. Too much to merge safely, so the mode below decides.',
    tone: 'error',
  },
  pinned: {
    title: 'Pinned — skipped',
    description: 'Pinned clones are held at their version. Only an explicit force reaches them, and only for locked fields.',
    tone: 'warning',
  },
};

export const CONFLICT_MODE_OPTIONS: Array<{ label: string; value: PushOptions['conflictMode'] }> = [
  { label: 'Skip conflicted clones', value: 'skip' },
  { label: 'Overwrite local changes', value: 'overwrite' },
];

export const CLONE_EDIT_DESCRIPTION =
  "This is the customer's own copy — saving here never touches the master agent. Divergence is recalculated against the master on every save, so editing a field back to the master's value clears it again.";

export const CLONE_HASH_INVALIDATION_MESSAGE =
  'Evaluation reset on this copy — the gate hashes the definition, so editing invalidates the pass. Re-run Evaluate before this copy can be published.';

/** Body of the re-clone confirmation. */
export const buildRecloneWarning = (customer: string, parent: string, masterVersion: number): string =>
  `Re-cloning discards every local change ${customer} has made to ${parent} and resets the copy to the master's current v${masterVersion}, with divergence cleared. There is no undo for a re-clone.`;

/** Body of the delete confirmation. */
export const buildCloneDeleteWarning = (customer: string, parent: string): string =>
  `${customer}'s copy of ${parent} will be removed and that customer will stop being served by it. The master agent and every other customer's copy are unaffected.`;

/* -------------------------------------------------------------------------- */
/* Pure rules                                                                 */
/* -------------------------------------------------------------------------- */

/** The master's definition, as the three overridable fields. */
export const masterDefinition = (master: Agent | null): CloneDefinition => ({
  prompt: master?.prompt ?? '',
  model: master?.model ?? '',
  tools: master?.tools ?? '',
});

/** The clone's effective definition — absent field reads through to the
 * master, but the value returned is the clone's own. */
export const resolveCloneDefinition = (clone: Clone, master: Agent | null): CloneDefinition => ({
  prompt: clone.prompt ?? master?.prompt ?? '',
  model: clone.model ?? master?.model ?? '',
  tools: clone.tools ?? master?.tools ?? '',
});

/** THE DIVERGENCE-ON-SAVE RULE — recomputed from scratch, field for field,
 * every save. Nothing is carried over from a previous `div`. */
export const recomputeDivergence = (edited: CloneDefinition, master: CloneDefinition): string[] =>
  CLONE_DEFINITION_FIELDS.filter(({ key }) => edited[key] !== master[key]).map(({ label }) => label);

/** Pin wins over divergence: a pinned clone reads as pinned whatever it holds. */
export const resolveCloneState = (divergenceCount: number, pinned: boolean): CloneState => {
  if (pinned) return 'pinned';
  return divergenceCount > 0 ? 'diverged' : 'in sync';
};

/**
 * The selected clone's detail table — three definition rows beside the
 * master's current value, then the facts about the copy itself.
 *
 * `isDiverged` is read from `clone.div`, not recomputed by string
 * comparison here — that is what a push actually reads. A missing master
 * is a real state (clones outlive their masters by design), not an error.
 */
export function buildCloneDetailRows(clone: Clone | null, master: Agent | null, canViewSpend: boolean): CloneFieldRow[] {
  if (!clone) return [];

  const target = masterDefinition(master);
  const current = resolveCloneDefinition(clone, master);
  const noMaster = master === null;
  /* The prompt is the only field long enough to need shortening, and both
     columns must shorten it the same way or they cannot be compared. */
  const forColumn = (key: CloneDefinitionKey, value: string): string =>
    key === 'prompt' ? truncateClonePrompt(value) : value || '—';

  const rows: CloneFieldRow[] = CLONE_DEFINITION_FIELDS.map(({ key, label }) => ({
    id: key,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value: forColumn(key, current[key]),
    masterValue: noMaster ? 'master deleted' : forColumn(key, target[key]),
    isDiverged: clone.div.includes(label),
  }));

  rows.push(
    { id: 'cust', label: 'Customer', value: clone.cust || '—' },
    { id: 'parent', label: 'Cloned from', value: clone.parent || '—' },
    {
      id: 'ver',
      label: 'Master version',
      value: `v${String(clone.ver)}`,
      masterValue: noMaster ? 'master deleted' : `v${String(master.ver)}`,
      isDiverged: !noMaster && clone.ver !== master.ver,
    },
  );

  if (canViewSpend) {
    rows.push({ id: 'spend', label: 'Spend', value: '', moneyAmount: clone.spend });
  }

  return rows;
}

/** Definition fields the master has locked against customer override. */
export function lockedDefinitionKeys(master: Agent | null): CloneDefinitionKey[] {
  if (!master) return [];
  return CLONE_DEFINITION_FIELDS.filter(({ key }) => master.locked.some((path) => path === key || path.startsWith(`${key}.`))).map(
    ({ key }) => key,
  );
}

/** Which bucket one clone falls into, and whether the push will write to it —
 * both the preview and the apply read this. */
export function classifyClone(clone: Clone, master: Agent, options: PushOptions): Pick<PushPlanEntry, 'bucket' | 'willApply' | 'reason'> {
  /* THE PIN RULE, first — it outranks everything below it. */
  if (clone.pinned) {
    if (!options.forcePinned) {
      return { bucket: 'pinned', willApply: false, reason: 'Pinned — held at its current version and skipped.' };
    }
    const locked = lockedDefinitionKeys(master);
    if (locked.length === 0) {
      return {
        bucket: 'pinned',
        willApply: false,
        reason: 'Pinned, and the master locks no definition fields — forcing would write nothing.',
      };
    }
    return { bucket: 'pinned', willApply: true, reason: `Pinned, but forced: ${locked.join(', ')} reset to the master.` };
  }

  const count = clone.div.length;

  if (count === 0) {
    if (clone.ver === master.ver) {
      return { bucket: 'clean', willApply: false, reason: `Already on v${master.ver} with no local changes.` };
    }
    return { bucket: 'clean', willApply: true, reason: `No local changes — moves v${clone.ver} to v${master.ver}.` };
  }

  if (count === 1) {
    return { bucket: 'merge', willApply: true, reason: `Merges around 1 local change (${clone.div[0] ?? 'unknown'}), which is kept.` };
  }

  if (options.conflictMode === 'overwrite') {
    return { bucket: 'conflict', willApply: true, reason: `${count} local changes will be overwritten by the master.` };
  }

  return { bucket: 'conflict', willApply: false, reason: `${count} local changes — skipped so they survive.` };
}

/** Plan a push. Rendered as the preview, then executed entry by entry.
 * Returns `null` when there is no master selected. */
export function planPush(clones: Clone[], master: Agent | null, options: PushOptions): PushPlan | null {
  if (!master) return null;

  const entries: PushPlanEntry[] = clones
    .filter((clone) => clone.parent === master.name)
    .map((clone) => ({
      cloneId: clone.id,
      customer: clone.cust,
      fromVersion: clone.ver,
      divergedFields: clone.div,
      ...classifyClone(clone, master, options),
    }));

  const counts: Record<PushBucket, number> = { clean: 0, merge: 0, conflict: 0, pinned: 0 };
  entries.forEach((entry) => {
    counts[entry.bucket] += 1;
  });

  return {
    masterName: master.name,
    toVersion: master.ver,
    entries,
    counts,
    applyCount: entries.filter((entry) => entry.willApply).length,
  };
}

/** The write one planned entry produces — every branch ends by recomputing
 * divergence rather than assuming it. */
export function buildPushPatch(clone: Clone, master: Agent, bucket: PushBucket): { id: string } & CloneDefinition & { div: string[]; ver: number; state: CloneState } {
  const target = masterDefinition(master);

  if (bucket === 'pinned') {
    const current = resolveCloneDefinition(clone, master);
    const next: CloneDefinition = { ...current };
    lockedDefinitionKeys(master).forEach((key) => {
      next[key] = target[key];
    });
    const div = recomputeDivergence(next, target);
    return { id: clone.id, ...next, div, ver: master.ver, state: resolveCloneState(div.length, true) };
  }

  if (bucket === 'merge') {
    const current = resolveCloneDefinition(clone, master);
    const next: CloneDefinition = { ...target };
    CLONE_DEFINITION_FIELDS.forEach(({ key, label }) => {
      if (clone.div.includes(label)) next[key] = current[key];
    });
    const div = recomputeDivergence(next, target);
    return { id: clone.id, ...next, div, ver: master.ver, state: resolveCloneState(div.length, false) };
  }

  /* clean, and conflict-with-overwrite: the master wins outright. */
  return { id: clone.id, ...target, div: [], ver: master.ver, state: resolveCloneState(0, false) };
}

/** Filter for the three list tabs. `push` is a panel and never reaches here. */
export function filterClonesByTab(clones: Clone[], tab: CloneTab): Clone[] {
  if (tab === 'diverged') return clones.filter((clone) => clone.div.length > 0);
  if (tab === 'pinned') return clones.filter((clone) => clone.pinned);
  return clones;
}
