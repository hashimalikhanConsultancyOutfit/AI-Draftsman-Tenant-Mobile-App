# Agents Teams module — spec

Ported from `ai-draftsman-FE-B2B/src/features/AgentTeams/**`,
`AgentTeamBuilder/**`, `store/api/agentTeams.api.ts` and the team half of
`Chat`'s New thread dialog. Every flow was clicked through live on
`b2b-fe.aidraftsman.ai/agent-teams` on 2026-10-15 (with a throwaway
"Claude QA Test Team", deleted afterwards). Sidebar: BUILD → right after
Playground, label "Agents Teams", subtitle "Several agents answering one
thread together", icon `account-tree` (web's AccountTreeIcon).

## API contracts

| Action | Method | Route | Notes |
|---|---|---|---|
| List teams | GET | `/agent-teams?search&page&limit` | Offset-paged `{items,total,page,limit,totalPages}`, 10 per page. Lists BUILDER and THREAD teams. `q`/`cursor` are 400s (`forbidNonWhitelisted`). |
| One team | GET | `/agent-teams/:id` | `specialists[]` (also read as `members[]`), `currentRevision`, `origin`, `conversationId`. |
| Tube map | GET | `/agent-teams/map` | `{ teams: TmTeamWire[] }`. **Returned HTTP 500 on 2026-10-15** — web shows "The tube map could not be loaded"; mobile shows the same state with Try again. |
| Create | POST | `/agent-teams` | `{ name, purpose?, memberAgentIds[1..8] }` — purpose omitted when blank. |
| Rename / re-purpose | PATCH | `/agent-teams/:id` | `{ name, purpose }` only, and only if changed. |
| Delete | DELETE | `/agent-teams/:id` | Soft delete. |
| Add member | POST | `/agent-teams/:id/members` | `{ agentId }` |
| Remove member | DELETE | `/agent-teams/:id/members/:memberId` | Membership ROW id. Server refuses removing the last one. |
| Enable / disable member | PATCH | `/agent-teams/:id/members/:memberId` | `{ enabled }` — bumps the revision. |
| Schedules | GET | `/agent-teams/:id/schedules` | Fetched only while the Schedules tab is open. |
| Add schedule | POST | `/agent-teams/:id/schedules` | `{ preset, objective, conversationId?, timezone? }` + `Idempotency-Key`. Preset is a LABEL. |
| Pause / resume | PATCH | `/agent-teams/:id/schedules/:sid` | `{ enabled }` |
| Stop | DELETE | `/agent-teams/:id/schedules/:sid` | |
| Run now | POST | `/agent-teams/:id/schedules/:sid/run-now` | + `Idempotency-Key`. A full, charged run. |
| Team's threads | GET | `/conversations?agentTeamId&limit=50` | Schedule form's Thread picker. |
| New team chat | POST | `/conversations` | `{ title?, mode: 'AGENT_TEAM', agentIds[1..8], knowledgeBaseId? }` |
| Agents to pick | GET | `/agents/available` | Reused from Chat (`useGetAvailableAgentsForChatQuery`). |

## Permissions

`agent_team.view` (sidebar + screens), `agent_team.build` (New team, New team
chat, Edit, Add specialist, member switch, Remove), `agent_team.delete`
(Delete), `agent_team.schedule` (Add schedule, Pause/Resume, Run now, Stop),
`chat.manage` (creating a team thread). Edit/Delete without the grant are
shown dimmed and answer a tap with web's tooltip text as a toast.

## Validation (identical to web's FormModal messages, confirmed live)

| Form | Field | Rule → message |
|---|---|---|
| New/Edit team | Team name | required → "Team name is required"; ≤120 → "Team name cannot be longer than 120 characters" |
| | Purpose | optional; ≤2000 → "Purpose cannot be longer than 2000 characters"; blank = server uses the name |
| | Agents | ≥1 → "Agents is required"; ≤8 → "Agents: pick at most 8"; unticked rows disable at 8 with "8 of 8 selected" |
| Add a specialist | Agent | required → "Agent is required"; current members filtered out |
| Schedule this team | How often | required → "How often is required"; defaults to "Daily · weekdays 07:00" |
| | What should the team do | required → "What should the team do is required"; ≤100000 |
| | Thread / Timezone | optional; timezone defaults to the device zone |
| New team chat | Thread name | optional; ≤200 |
| | Agents | as for New team |

## Behaviour carried over from web

- Toasts: "{name} created.", "{name} saved.", "Nothing changed.", "{name} deleted.", "Member added. The team is on a new revision…", "{name} removed. The evaluation needs re-running.", schedule created/paused/resumed/stopped/run-started copy.
- Edit sends PATCH (if name/purpose changed) → adds → removes, in that order.
- Purpose equal to the name is shown blank in Edit and hidden under the name in the list.
- A deleted row disappears at once and the list restarts from page 1. Search resets to page 1.
- Chat on a THREAD team ("From chat") re-opens its own thread ("Open chat"); on a BUILDER team it opens New team chat with the team's agents preselected ("Chat" / "Start a thread").
- Delete / Remove / Stop are confirmed with web's exact title, body and button text (`Alert.alert`). Run now is not confirmed, as on web.
- A paused schedule shows "—" for its next run; the "Each occurrence is charged" banner shows above the list.

## Deliberate mobile deviations

- **List** is a stack of cards (laid out like Company agents' card: identity row, purpose, Specialists / Revision / Updated strip, Chat / Edit / Delete buttons) rather than a table. Paging uses this app's standard "Load more" button (as Customers, Lead criteria, Reports, Support) over the same 10-per-page offset API, with a "{n} teams" count above the list, instead of web's numbered pager. Pull-to-refresh, a new search, a delete, and returning from a form all restart from page 1. Search is debounced 300 ms (web fires per keystroke).
- **Dialogs** are modal stack routes: `AgentTeamForm`, `AgentTeamAddMember`, `AgentTeamScheduleForm`, `AgentTeamChat`.
- **Tube map** is a vertical line per team, stops grouped by the same seven stages; interchanges ringed and tagged "Shared by N", stops needing a look drawn hollow/dashed; tapping a stop or a team opens a bottom sheet with web's side-panel details, plus "Open team".
- **New team chat** lives in this module because mobile Chat had no team mode. `ChatMode` now includes `AGENT_TEAM`; the thread opens in the existing conversation screen.
- **Team run page** (`/agent-teams/:id/runs/:runId`) is not ported — web reaches it from inside Chat, not from this module.
