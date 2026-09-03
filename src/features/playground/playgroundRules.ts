/**
 * Playground — pure business rules and copy, ported from the web app's
 * `Playground.data.ts` / `usePlayground.tsx` (confirmed against that source
 * on 2026-09-03).
 */

import type { AgentVersionWire } from '@/features/company-agents/companyAgents.types';

import type { PromptVersion } from './playground.types';

/** "2 hours ago" / "yesterday"-style relative time, same shape as the other
 * modules' own local copies (see e.g. Lead criteria's `relativeTime`). */
export function relativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** One page of version-history rows, newest first. */
export function toPromptVersions(items: AgentVersionWire[]): PromptVersion[] {
  return items.map((item) => ({
    id: item.id,
    version: item.version,
    label: `v${item.version}`,
    prompt: item.definition?.prompt,
    note: item.note ?? 'No change note given.',
    author: item.creator?.name ?? item.creator?.email ?? 'System',
    at: relativeTime(item.createdAt),
  }));
}

/* -------------------------------------------------------------------------- */
/* The default use case — seeds the system prompt on first load               */
/* -------------------------------------------------------------------------- */

export const PLAYGROUND_USE_CASE_DEFAULT =
  'Answer supply-chain support questions using only the supplied documents. Quote the clause you relied on and name its source file. If the documents do not settle the question, say so and say what would.';

/* -------------------------------------------------------------------------- */
/* Authorisation copy — per-action, since the actions are three grants from   */
/* two modules and one sentence could not cover them.                        */
/* -------------------------------------------------------------------------- */

export const NO_BUILD_MESSAGE = 'You do not have permission to save prompts or create agents.';
export const NO_RESTORE_MESSAGE = 'You do not have permission to restore an earlier version.';
export const NO_RUN_MESSAGE = 'You do not have permission to run prompts in the playground.';
export const NOTHING_TO_RUN_MESSAGE = 'Add a use case and system prompt first.';
export const ALREADY_CURRENT_MESSAGE = 'That version is already in force.';

export const AGENTS_PER_PAGE = 6;
