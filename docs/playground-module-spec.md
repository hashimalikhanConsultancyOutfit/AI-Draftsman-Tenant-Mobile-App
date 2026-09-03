# Playground module — spec

Ported from `ai-draftsman-FE-B2B/src/features/Playground/**` and
`ai-draftsman/apps/gateway-b2b/src/app/knowledge-bases/knowledge-bases.controller.ts`
(confirmed against that source on 2026-09-03). Try a system prompt against a
use case before shipping it as an agent.

## API contracts

| Action | Method | Route | Notes |
|---|---|---|---|
| Run a prompt | POST | `/knowledge-bases/playground` | `{ systemPrompt, useCase }` → `{ response, served: 'ml' \| 'dummy' }`. Stateless — nothing is stored. |
| List agents | GET | `/agents` | Reused from Company agents (`useGetAgentsQuery`) — the roster is the same company agent set. |
| Version history | GET | `/agents/{id}/versions?page&limit&sortBy=version&sortOrder=desc` | Newly added to `companyAgentsApi.ts` — genuinely an Agent endpoint, not a Playground one (mirrors web's own `agents.api.ts`). Page 1 is always the version in force. |
| Save a new prompt version | PUT | `/agents/{id}/prompt` | `{ prompt, note? }` → the new `AgentVersionWire`. Gated on `agent.build`. |
| Restore a version | PUT | `/agents/{id}/versions/{version}/current` | Idempotent — moves the pointer, writes no new row, repeatable either direction. Gated on `agent.restore`. |
| Save as agent | POST | `/agents` | Reuses Company agents' own `createAgent` mutation and `AgentFormScreen` in place. |

Four grants, from two modules — mirrored exactly from web: `playground.view`
(this screen), `playground.run` (the Run button), `agent.build` (Save as
agent / Edit prompt — both write the agent registry, not a Playground
permission), `agent.restore` (the history table's Restore action).
`usage.view` gates the run's cost figure, `billing.view` gates an agent's
price on its roster card.

## Deliberate mobile deviations

- **Agent roster** is a vertical stack of full-width cards (matching this
  app's own Company Agents list) rather than web's 3-column desktop grid.
  The 6-per-page Prev/Next pager is kept, since the underlying data is the
  same bounded, un-paginated `GET /agents` list either way.
- **"Save as agent"** reuses `AgentFormScreen` in place via a new optional
  `initialPrompt` route param, cross-navigated from the Playground stack —
  the same "reuse the screen, don't duplicate the form" convention already
  established by `DashboardStack` and `MarketplaceStack`. Web instead shares
  a `buildCreateAgentFields` field-builder across three separate dialogs;
  mobile's approach is the tighter of the two, since it shares the whole
  screen (validation, the Lab → Model picker, the "models unavailable" retry
  banner) rather than only its field config.
- **Edit prompt** is a full-screen `Modal` (prompt + optional note), matching
  the precedent set by Lead criteria's rule editor, rather than a MUI dialog.
- **Version history** uses a numbered Prev/Next pager instead of a
  `DataTable` + `TablePager`, sized for a phone screen. Semantics are
  unchanged: server-paginated, newest first, page 1 doubles as "the version
  in force."
- **Latency** is timed with `Date.now()` rather than `performance.now()`
  (no reason to reach for the latter in this environment).
- **Cost and citations always read 0** on both platforms — not a gap this
  port introduces: web's own `handleTry` hardcodes both, since
  `POST /knowledge-bases/playground` reports no run telemetry today.

## Definition of done

- [x] `tsc --noEmit` clean
- [x] `expo export --platform ios --no-bytecode` clean (1580 modules)
- [x] Every permission gate applied: `playground.view` (screen), `playground.run`
      (Run button + toast), `agent.build` (Save as agent, Edit prompt),
      `agent.restore` (history Restore), `usage.view` (cost), `billing.view`
      (roster price)
- [ ] Tested on a real device as owner, member, and one custom role
- [ ] Dark mode pass

## Files

**New:**
- `src/features/playground/playground.types.ts`
- `src/features/playground/playgroundApi.ts`
- `src/features/playground/playgroundRules.ts`
- `src/features/playground/schemas/editPromptSchema.ts`
- `src/features/playground/components/AgentRosterCard.tsx`
- `src/features/playground/components/EditPromptModal.tsx`
- `src/features/playground/PlaygroundScreen.tsx` (overwrote the
  `ModulePlaceholderScreen`-based stub)
- `src/navigation/stacks/PlaygroundStack.tsx`

**Edited:**
- `src/features/company-agents/companyAgents.types.ts` — added
  `AgentVersionWire`, `AgentVersionsPageWire`, `UpdateAgentPromptRequest`,
  `RestoreAgentVersionRequest`.
- `src/features/company-agents/companyAgentsApi.ts` — added
  `AGENT_VERSIONS_PAGE_SIZE`, `getAgentVersions`, `updateAgentPrompt`,
  `restoreAgentVersion`.
- `src/features/company-agents/AgentFormScreen.tsx` — the create-mode
  `prompt` default now reads `params?.initialPrompt ?? ''`.
- `src/navigation/types.ts` — every `AgentForm` route param type gained
  `initialPrompt?: string`; added `PlaygroundStackParamList`; the drawer's
  `Playground` entry now carries `NavigatorScreenParams<PlaygroundStackParamList>`.
- `src/navigation/AppDrawer.tsx` — `Playground` drawer screen now mounts
  `PlaygroundStack` instead of `PlaygroundScreen` directly.
