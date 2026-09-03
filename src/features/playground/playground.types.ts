/**
 * Playground — types. Ported from the web app's `Playground.interface.ts`
 * (confirmed against that source on 2026-09-03), trimmed to what the mobile
 * screen actually needs: agents are read straight off `Agent` from
 * `@/features/company-agents/companyAgents.types` rather than through a
 * second, near-identical `PlaygroundAgent` shape.
 */

/** One entry in the prompt's version history — mapped from `AgentVersionWire`. */
export interface PromptVersion {
  id: string;
  /** Monotonic version number. */
  version: number;
  /** Display label, e.g. "v4". */
  label: string;
  /** The full system prompt at this version. */
  prompt?: string;
  /** Why it changed. */
  note: string;
  /** Who cut it. */
  author: string;
  /** Relative timestamp. */
  at: string;
}

/** The single answer shown in the response panel after a run. */
export interface PlaygroundResponse {
  /** The answer text. */
  body: string;
  /** Cost of the run in GBP — always 0: the run endpoint reports no telemetry
   * yet, matching the web app's own `handleTry` (see `Playground.tsx`). */
  cost: number;
  /** Round-trip latency in milliseconds, timed on-device. */
  latencyMs: number;
  /** How many documents the answer cited — always 0, same reason as `cost`. */
  citations: number;
  served: 'ml' | 'dummy';
}

/** A prompt draft or a response, scoped to the agent it belongs to — so
 * switching agents doesn't carry one agent's unsaved edit or answer onto
 * another's card. Mirrors web's `AgentScopedValue`. */
export interface AgentScopedValue<T> {
  agentKey: string | null;
  value: T;
}
