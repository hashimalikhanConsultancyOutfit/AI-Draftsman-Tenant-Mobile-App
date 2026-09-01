/**
 * Company agents — pure business rules, ported from the web app's
 * `CompanyAgents.data.ts` / `useCompanyAgents.tsx` (confirmed against that
 * source on 2026-09-01).
 */

import type { Agent, AgentFieldRow, EvaluationBadge } from './companyAgents.types';

/**
 * The publish gate. Confirmed live against the actual tenant portal on
 * 2026-09-01: agents scoring 62.5 and 75.0 both render "Pass" on the web app
 * and are Deployed, which only holds if the real threshold is 50 — the web
 * app's `agentGate.ts` (`EVAL_PASS_THRESHOLD = 50`), not the 80 its own
 * `CompanyAgents.data.ts` copy (`PUBLISH_GATE_TOOLTIP`) claims in text.
 * Mirroring the live BEHAVIOUR, not the stale tooltip. Enforcement is
 * server-side regardless (a publish attempt below this 403s); this is only
 * the client-side hint that disables the button before that round trip.
 */
export const PUBLISH_PASS_THRESHOLD = 50;

export const hasPassedGate = (score: number | null): boolean =>
  score !== null && score >= PUBLISH_PASS_THRESHOLD;

/** How a score reads on a card/detail screen: green pass, red fail, red
 * never-evaluated. `score` is a percentage, 0-100. */
export function buildEvaluationBadge(score: number | null): EvaluationBadge {
  if (score === null) return { label: 'Not evaluated', tone: 'error' };
  if (hasPassedGate(score)) return { label: `Pass ${score.toFixed(1)}`, tone: 'success' };
  return { label: `Fail ${score.toFixed(1)}`, tone: 'error' };
}

/** Is a field locked against customer override? `locked` holds paths, so
 * `prompt.COMPLIANCE` locks part of the prompt and marks the whole row. */
export const isFieldLocked = (locked: string[], field: string): boolean =>
  locked.some((path) => path === field || path.startsWith(`${field}.`));

export const MEMORY_LABELS: Record<Agent['memory'], string> = {
  NO_MEMORY: 'No memory',
  SHORT_TERM: 'Short term — within a conversation',
  LONG_TERM: 'Long term — across conversations',
};

export const MEMORY_OPTIONS: Array<{ label: string; value: Agent['memory'] }> = [
  { label: 'No memory', value: 'NO_MEMORY' },
  { label: 'Short term — within a conversation', value: 'SHORT_TERM' },
  { label: 'Long term — across conversations', value: 'LONG_TERM' },
];

export const PRICING_MODE_OPTIONS: Array<{ label: string; value: Agent['mode'] }> = [
  { label: 'Included in plan', value: 'INCLUDED' },
  { label: 'Per run', value: 'PER_RUN' },
  { label: 'Per token', value: 'PER_TOKEN' },
];

export const PRICING_MODE_LABELS: Record<Agent['mode'], string> = {
  INCLUDED: 'Included in plan',
  PER_RUN: 'Per run',
  PER_TOKEN: 'Per token',
};

/** An agent installed from the marketplace — no Edit, no Delete. The
 * definition belongs to the catalogue entry, not this workspace. */
export const isClonedAgent = (agent: Agent): boolean => Boolean(agent.clonedFromMarketplaceId);

/** "v3 of 5" when rewound, plain "v3" on the ordinary case, "No versions" for
 * a never-edited agent. */
export function formatAgentVersion(agent: Pick<Agent, 'ver' | 'currentVersion'>): string {
  if (!agent.ver) return 'No versions';
  const pointer = agent.currentVersion ?? agent.ver;
  return pointer >= agent.ver ? `v${pointer}` : `v${pointer} of ${agent.ver}`;
}

/** The detail screen's field table. Pricing is omitted entirely (not
 * blanked) without `billing.view`, so the figure never reaches the screen. */
export function buildDetailRows(agent: Agent, canViewPricing: boolean): AgentFieldRow[] {
  const rows: AgentFieldRow[] = [
    { id: 'prompt', label: 'System prompt', value: agent.prompt, isLocked: isFieldLocked(agent.locked, 'prompt') },
    { id: 'model', label: 'Model', value: agent.model, isLocked: isFieldLocked(agent.locked, 'model') },
    { id: 'tools', label: 'Tools', value: agent.tools || '—', isLocked: isFieldLocked(agent.locked, 'tools') },
    { id: 'kb', label: 'Knowledge base', value: agent.kb, isLocked: isFieldLocked(agent.locked, 'kb') },
  ];

  if (agent.clonedFromMarketplace) {
    rows.push({
      id: 'marketplace',
      label: 'Installed from',
      value: agent.clonedFromMarketplace.categoryName
        ? `${agent.clonedFromMarketplace.name} (${agent.clonedFromMarketplace.categoryName})`
        : agent.clonedFromMarketplace.name,
      isLocked: false,
    });
  }

  rows.push(
    { id: 'creator', label: 'Created by', value: agent.creator?.name ?? '—', isLocked: false },
    { id: 'memory', label: 'Memory', value: MEMORY_LABELS[agent.memory ?? 'NO_MEMORY'], isLocked: isFieldLocked(agent.locked, 'memory') },
    { id: 'support', label: 'Support agent', value: agent.isSupportAgent ? 'Yes' : 'No', isLocked: false },
  );

  if (canViewPricing) {
    rows.push({
      id: 'price',
      label: 'Pricing',
      value: PRICING_MODE_LABELS[agent.mode],
      moneyAmount: agent.price,
      isLocked: isFieldLocked(agent.locked, 'price'),
    });
  }

  rows.push({
    id: 'evaluation',
    label: 'Evaluation',
    value: buildEvaluationBadge(agent.score).label,
    isLocked: isFieldLocked(agent.locked, 'evaluation'),
  });

  return rows;
}

/** Body of the delete confirmation. The orphaning rule is the whole point —
 * deleting a master does NOT delete its deployed clones. */
export function buildDeleteWarning(agentName: string, cloneCount: number): string {
  if (cloneCount === 0) {
    return `${agentName} will be removed. It has no clones deployed, so nothing else is affected.`;
  }
  return `${agentName} will be removed, but its ${cloneCount} deployed ${
    cloneCount === 1 ? 'clone is' : 'clones are'
  } NOT deleted. Each clone is a full independent copy and keeps serving its customer — it simply becomes orphaned, with no master left to push updates from. Re-cloning those customers onto a new master is the only way to reconnect them.`;
}

/** Publish is blocked when the agent has not cleared the gate. Already-deployed
 * agents may still re-publish (e.g. after an edit re-passes evaluation). */
export const isPublishBlocked = (agent: Agent): boolean => !hasPassedGate(agent.score);

/**
 * Mobile-only rule — NOT ported from web. The web app lets Clone out fire
 * from any lifecycle state (it's gated purely on the `agent.clone`
 * permission there); on mobile we additionally require the agent to be
 * Deployed first, so a customer never receives a copy of a draft that has
 * never passed evaluation and gone live.
 */
export const isCloneOutBlocked = (agent: Agent): boolean => agent.state !== 'deployed';
