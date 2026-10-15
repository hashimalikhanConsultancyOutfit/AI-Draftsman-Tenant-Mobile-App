# Phase 7 — Chat: build spec and traceability

Derived from three passes over primary sources on 3 Sep 2026: the NestJS
backend (`ai-draftsman`, chat gateway + `b2b-chat`), the web portal
(`ai-draftsman-FE-B2B/src/features/Chat/**`, ~5,600 lines), and the old
mobile app's `ChatConversationScreen` for design language. Where the
deliverable docs and the source disagreed, **the source won** — those
disagreements are listed in §6.

---

## 1. API contract (confirmed against backend source)

Base `https://be-api.aidraftsman.ai/api/v1`. Every unknown body key is a 400
(`forbidNonWhitelisted`). REST errors are `{ statusCode, message, errors }` —
**no `details.code`** on the chat surface (the gateway's
`RpcHttpExceptionFilter` drops `details`). Branch on HTTP status.

### Pagination — cursor, not page/limit
- Query: `cursor?` (opaque, ≤500), `limit?` (1..100, default 30).
- Conversations respond `{ items, nextCursor, hasMore, total }`.
- Messages respond `{ items, nextCursor, hasMore }` — **no `total`**.
- `hasMore`/`nextCursor` is the only correct "load more" signal.
- Conversations keyset on `(lastActivityAt, id)` desc; messages on `sequence` desc.
- `pinned` is NOT in the DB ordering — sort pinned to the top client-side.

### Conversations
| Method | Path | Permission |
|---|---|---|
| POST | `/conversations` | `chat.manage` |
| GET | `/conversations` | none |
| GET | `/conversations/:id` | none (only place `retention` appears) |
| PATCH | `/conversations/:id` | `chat.manage` |
| POST | `/conversations/bulk-delete` | `chat.manage` |
| DELETE | `/conversations/:id` | `chat.manage` |
| GET | `/conversations/:id/balance` | none |
| GET | `/conversations/:id/models` | none |
| PATCH | `/conversations/:id/model` | `chat.manage` |
| POST | `/conversations/:id/pin` | `chat.manage` |
| PATCH | `/conversations/:id/knowledge-base` | `chat.manage` |
| POST | `/conversations/:id/read` | none |

Create body: `{ title?, mode: 'SOCKET'|'AGENT', agentId? (required on AGENT),
modelType?/modelId? (both or neither), projectId?, knowledgeBaseId? }`.
A blank title is **omitted**, never sent as `''`.

Update body: `title? 1-200`, `status? 'ACTIVE'|'ARCHIVED'` — `DELETED` is rejected.

Bulk delete: `{ ids }`, 1..100, unique. Unwritable ids come back in
`skippedIds`, not as an error.

### Messages
| Method | Path | Permission |
|---|---|---|
| GET | `/conversations/:id/messages` | none |
| POST | `/conversations/:id/messages` | `chat.send` |
| POST | `/messages/:id/retry` | `chat.send` |
| DELETE | `/messages/:id` | `chat.manage` |

Send body: `{ body (1..32000), idempotencyKey (required, unique per
conversation), richContent?, replyToId?, attachmentIds? (max 10) }`.
Returns 200 on **both** branches; a replay is `created: false` with the
original message and no counter movement.

Retry applies only to a **FAILED assistant** turn and needs its own new key.

### Money redaction — omission, not zero
`canSeeMoney(role) === role in {OWNER, ADMIN, FINANCE}`. For BUILDER and
MEMBER the cost/token keys are **absent at every nesting level**. Test with
`'totalCostCents' in obj`, never truthiness. `modelSlug` is not a cost field —
every role sees it.

### Composer gating — two independent sources
1. `ConversationResponseDto.canSend` + `sendBlockedReason` (today only
   `AGENT_DELETED`). Bind the composer to this one field; do not re-derive.
2. `GET /conversations/:id/balance` → `{ balanceKnown, canSend, blockedBy:
   'TENANT'|'CUSTOMER'|'KEY'|'WALLET'|null, message, approaching }`.
   `balanceKnown: false` means billing is down and `canSend` is **true** —
   do not block on a billing outage.

### Attachments — three calls
1. `POST /attachments/upload-intent` (`chat.send`) → `{ attachmentId,
   uploadPath, stagedUntil, maxBytes }`
2. `POST /attachments/:id/content` (`chat.send`) — multipart, field name
   **`file`**, one file → `{ id, status: 'READY'|'FAILED', ... }`
3. Reference the id in `attachmentIds[]` on the send.

Limits: 25 MiB per file, 10 per message. Extensions by kind —
FILE `pdf doc docx xls xlsx ppt pptx csv txt md json zip`;
PHOTO `png jpg jpeg webp gif`; VIDEO `mp4 webm mov`; VOICE `webm ogg mp3 m4a wav`.
Download: `GET /attachments/:id/content` → a signed URL expiring in **120
seconds**. Never cache it; mint at the moment of use.
Delete: staged attachments only — 400 once bound to a sent message.

---

## 2. Socket contract

Namespace **`/chat`**. Auth token goes in `handshake.auth.token` — the query
string is never read. On connect the server auto-joins `tenant:{id}` and
`user:{id}`; a conversation room needs an explicit `conversation:join`.

Client -> server (all acked `{ok:true,data} | {ok:false,error:{code,message,correlationId,retryable}}`):
`conversation:join` · `conversation:leave` · `message:send` · `message:cancel` ·
`typing:start` · `typing:stop` · `message:read` · `connection:resume`.

Server -> client: `message:created` · `message:pending` · `message:delta` ·
`message:complete` · `message:failed` · `message:cancelled` · `typing` ·
`conversation:updated` · `usage:updated` (cost room only) · `limit:exceeded` ·
`auth:reauth-required` · `error`.

**Never emitted by any publisher** — do not build blocking UI on them:
`attachment:status`, `presence`, `limit:warning`.

Streaming: deltas coalesce server-side on an 80 ms flush. `chunkIndex`
increments only on a real emit, so a gap is a genuinely lost frame ⇒ resync.
`message:complete.body` is **authoritative — replace, do not append**.

Reconnect: join, then `connection:resume { conversationId, lastSequence }`.
`refetchRequired: true` ⇒ drop the local tail and refetch over REST (`missed`
comes back empty in that case). De-duplicate by `messageId` + `sequence`: after
a reconnect the socket id changed, so previously origin-routed frames now
arrive as room broadcasts.

Rate limits (60 s windows): sends 30/socket, 60/user, 600/tenant — fails
**closed**. Actions 60/120/1200 — fails **open**. Typing is not counted.

Traps:
- Socket `message:read` uses `uptoSequence`; REST uses `upToSequence`. Both real.
- A **402 over the socket surfaces as `INTERNAL` with `retryable: true`** —
  special-case it or the client loops on an empty wallet. On `INTERNAL` from a
  send, re-read `/balance` before retrying.
- `chat.send` is **not** enforced on the socket path — only room membership
  and `role !== FINANCE`.
- `usage:updated` payload drift: declared `{conversationId,totalCostCents,
  totalTokens}`, actually emits `{conversationId,messageId,promptTokens,
  completionTokens,costCents}`. Build against the emitted shape.

---

## 3. Permissions

`chat.view` (read) · `chat.manage` (create/rename/pin/archive/delete/model) ·
`chat.send` (compose) · `usage.view` (cost figures — **not** a chat slug).

**Every read route in the chat module is ungated** — that is deliberate and
documented backend-side. Gate read screens on `chat.view` for navigation only.

Web treatment, mirrored here: `chat.manage` controls are **hidden**;
`chat.send` is **disabled with the reason echoed underneath**, never hidden;
cost figures are **absent from the tree**, never zeroed.

---

## 4. Mobile decisions taken (divergences from web, with reasons)

| # | Decision | Why |
|---|---|---|
| D-1 | Three columns become three screens: ThreadList -> Conversation -> Details | A phone cannot stack 280/1fr/320 |
| D-2 | **Enter inserts a newline; Send is a button** | Web sends on Enter; on a soft keyboard that sends every prompt half-written |
| D-3 | Explicit "Select" action + long-press, no hover checkbox | Hover is load-bearing in three places on web and does not exist here |
| D-4 | No `aria-disabled` two-state Delete button | A tooltip-dependent desktop invention; unlabelled trap on a phone |
| D-5 | Composer block copy gets a real navigation CTA | Web names the destination in prose only |
| D-6 | `gestureEnabled: false` while streaming | A swipe-back mid-stream abandons a generation the user is paying for |
| D-7 | Thread list pages properly | Web never advances its cursor — only the first 30 ever show, while the badge shows the true total |
| D-8 | No unread badge | Would cost one `GET /participants` per thread; no backend field exists |
| D-9 | Plain text + code-block rendering, **no markdown library** for v1 | `react-native-markdown-display` is not a dependency; structured `richContent` parts carry most of the shape |
| D-10 | No dictation | Web Speech API does not exist on RN; a real recorder is a separate piece of work |
| D-11 | No camera capture | Net-new with no web behaviour to port |
| D-12 | Historic VOICE attachments render; none can be created | Matches web exactly — the composer lost voice capture |
| D-13 | Send queue keeps the behaviour, drops the FLIP animation | The animation is a pure DOM reflow technique |

---

## 5. Traceability — Chat flows

Status: `TODO` / `WIP` / `DONE`. A flow is not done until its row is ticked
and its states (loading / empty / error / permission) are verified.

| ID | Flow | Screens | Endpoints / events | Permission | Status |
|---|---|---|---|---|---|
| C-01 | Open module, list threads | ThreadList | `GET /conversations` | none (nav on `chat.view`) | WIP |
| C-02 | Archived folder | ThreadList | `GET /conversations?status=ARCHIVED` | none | WIP |
| C-03 | Search threads | ThreadSearch | `GET /conversations?search=` | none | WIP |
| C-04 | New thread | NewThread sheet | `POST /conversations`, `GET /agents/available` | `chat.manage` | WIP |
| C-05 | Open thread | Conversation | `GET /conversations/:id`, `/messages`, `/balance`, `/models`, `conversation:join` | none | WIP |
| C-06 | Send a message | Conversation | `message:send` -> `POST /conversations/:id/messages` fallback | `chat.send` | WIP |
| C-07 | Streaming a reply | Conversation | `message:pending/delta/complete/failed/cancelled` | — | WIP |
| C-08 | Stop a generation | Conversation | `message:cancel` (no REST equivalent) | — | WIP |
| C-09 | Retry a failed turn | Conversation | resend, or `POST /messages/:id/retry` | `chat.send` | WIP |
| C-10 | Load earlier messages | Conversation | `GET /conversations/:id/messages?cursor=` | none | WIP |
| C-11 | Send queue (parked turns) | Conversation | — | `chat.send` | WIP |
| C-12 | Attach a file | Conversation | `POST /attachments/upload-intent`, `/:id/content`, `DELETE /attachments/:id` | `chat.send` | WIP |
| C-13 | Open a received attachment | Conversation | `GET /attachments/:id/content` | none | WIP |
| C-14 | Citations | Conversation | inline on the message | none | WIP |
| C-15 | Rename a thread | Rename sheet | `PATCH /conversations/:id` | `chat.manage` | WIP |
| C-16 | Pin / unpin | ThreadList | `POST /conversations/:id/pin` | `chat.manage` | WIP |
| C-17 | Archive / unarchive | ThreadList | `PATCH /conversations/:id {status}` | `chat.manage` | WIP |
| C-18 | Delete one or many | Confirm | `POST /conversations/bulk-delete` | `chat.manage` | WIP |
| C-19 | Selection mode | ThreadList | — | `chat.manage` | WIP |
| C-20 | Set knowledge base | Sheet | `PATCH /conversations/:id/knowledge-base` | `chat.manage` | WIP |
| C-21 | Change model | Details | `GET /conversations/:id/models`, `PATCH .../model` | `chat.manage` | WIP |
| C-22 | Retention readout | Details | `GET /conversations/:id` `.retention` | none (read-only by design) | WIP |
| C-23 | Cost readout | Details / bubbles | omitted fields | `usage.view` | WIP |
| C-24 | Typing indicators | Conversation | `typing:start/stop`, `typing` | — | WIP |
| C-25 | Read receipts | Conversation | `message:read` / `POST /conversations/:id/read` | none | WIP |
| C-26 | Reconnect + resume | Conversation | `connection:resume` | — | WIP |
| C-27 | Balance-blocked composer | Conversation | `GET /conversations/:id/balance` | none | WIP |
| C-28 | Answer an inline agent question | Conversation | ordinary send | `chat.send` | WIP |

---

## 6. Open questions (source disagreements — do not hard-code either side)

1. **Which roles hold chat write slugs.** The web feature's own README says
   ADMIN and BUILDER can write; `role-permission-matrix.md` says neither holds
   a chat token at all and only MEMBER gets `chat.send` (via `chat:*`).
   Mitigation in code: key every write off the resolved `perms`, never off the
   role name.
2. `GET /runs/:id` and `GET /conversations/:id/runs` have no DTO — response
   shape UNKNOWN. Run traces are therefore out of this phase.
3. `usage:updated` — which of the two payload shapes is intended.
4. `RETENTION_INDEFINITE` on web is named "keep indefinitely" but its string
   reads "Delete after 90 days" for `deleteAfterDays: 0`. Copy bug on web;
   this app will say "Keep indefinitely" unless told otherwise.

---

## 7. Implementation status (3 Sep 2026)

All 28 flows above are code-complete: ThreadList, Conversation, ThreadDetails
and ThreadSearch screens are built and wired into `ChatStack`, backed by
`chatApi.ts` (REST + cursor pagination + socket-patched cache) and
`chatSocket.ts`. `tsc --noEmit` is clean for the whole project and a full
Metro export (`expo export --platform ios --no-bytecode`) bundles all 1552
modules with no resolution errors — the same two checks used for every prior
phase in this build.

Marked **WIP** rather than **DONE** because the definition of done in the
header of §5 has a second half that hasn't run yet: no pass on a real device
or simulator, no exercise across 3 roles (owner / member / a custom role with
`chat.send` but not `chat.manage`, and one with neither), no dark-mode
check, and no second cross-read against the live web source. That
verification pass — not new code — is what is left before Chat can be
marked DONE and the build moves on to Phase 11 (Leads).

Known deliberate gaps, matching §4's divergence table: no markdown rendering
(D-9), no dictation or camera capture (D-10/D-11), historic VOICE
attachments play back but none can be newly recorded (D-12).


---

## Team chat (added 2026-10-15)

Ported from the web portal's Chat (`features/Chat/chatThreadMode.ts`,
`chatTeamRun.ts`, `teamMeter.ts`, `SpecialistReplies`, `TeamMeterBand`,
`TeamStatusCard`, `InteractionBlock`, `TeamAttachMenu`) and checked live on
`b2b-fe.aidraftsman.ai/chat` on 2026-10-15.

### Thread list — Chat / Teams tabs
- Two tabs above the list, `Chat {n}` and `Teams {n}`, as on web (no "All").
  A team thread is `mode === 'AGENT_TEAM'` **and** has `agentTeamId`;
  everything else (AGENT, SOCKET) is under Chat. Counts are of the LOADED
  threads — the list API has no `mode` filter (web counts the same way).
- Archived threads are filtered by the same tab.
- A tab with nothing in it while the other has threads shows web's
  "No team chats here" / "No one-agent chats here" with a "Show chats (n)" /
  "Show teams (n)" action.
- Team rows show the team name and a team icon.

### New thread — "Answered by"
- "One agent" / "A team of agents", defaulting to the tab it was opened from.
- Team mode: Agents checklist (search, "n of 8 selected", unticked rows
  disable at 8) — "Agents is required" / "Agents: pick at most 8".
- `POST /conversations { title?, mode: 'AGENT_TEAM', agentIds, knowledgeBaseId? }`.

### Conversation — team threads
- Sub-header shows the team name and its agent count.
- Specialist replies (messages WITH `agentId`) are folded under the final
  answer (the message with NO `agentId`): "Based on N specialist replies" +
  "Show/Hide N specialist replies"; while the answer is being written:
  "{who} has/have finished. The team is preparing the final response."; if
  the answer failed it starts open ("The final answer did not finish · …").
  Each specialist reply is labelled with its agent's name.
- Run band above the composer for the latest run (`GET /agent-team-runs?conversationId`):
  web's headline/subline ("Team finished", "2 agents are working",
  "The team lead answered directly · the answer is in the chat", …), run
  clock, `↑ in · ↓ out` tokens ("this run" / "this run so far"), and one row
  per agent (Working · m:ss / Up next / Needs an answer / Done / Couldn't
  finish) built from the run's events. Open while live, closed once settled.
  "Stop run" (`agent_team.cancel`) while live.
- Live updates: polls the run every 3 s while live (web's `RUN_POLL_MS`) and
  refetches at once on a `team:run:event` socket frame for the thread.
- A paused run (`interactions` with status OPEN) shows web's approval card:
  one button per offered resolution + decline ("Stop this run" / "Skip this
  task and continue"), gated on `agent_team.approve`. `CREATE_AGENT` opens
  web's agent builder; mobile says it is done on the web portal.

### Thread details — team threads
- Model: "Team threads use each agent's own model. Each reply shows the
  model that wrote it."
- "Attached to this team" replaces the single knowledge base: knowledge
  bases and connectors, each tick PATCHing `/agent-teams/:id`
  (`knowledgeBaseIds` / `connectorInstallIds`, replaced wholesale), gated on
  `agent_team.build`.
- Team run: the latest run's agents and their state, the ones "not needed
  for this question" (Idle), tokens and run cost (cost needs `usage.view`).
- Runs in this thread: one row per run — status, date, duration, cost.

### Not ported
- Web's "This run over time" / tokens-by-agent / tokens-by-model charts and
  the "show in band" lane pinning — the run band and the details screen
  carry the same facts as lists.
- Web groups ALL threads' agent-attributed replies; on a one-agent thread
  that hides every answer behind "A specialist has finished…" (seen live on
  the "AI model" thread). Mobile groups team threads only.

## New thread form — aligned with web (2026-10-15)
Matches web's `NEW_THREAD_FIELDS` / `useChat` modal config:
- **Thread name** (optional), placeholder "e.g. Barrow Foods · returns policy", hint "Optional — leave it blank and the first message names the thread."
- **Answered by \*** — a select: One agent / A team of agents (defaults to the list tab it was opened from).
- **Agent \*** — a searchable select ("Search agents…"), preselected to the first usable agent. Every agent is listed; non-deployed ones are disabled with the reason (not evaluated / archived / not deployed). If the list fails: "Could not load the agent list. The thread cannot be created until it loads — …".
- **Agents \*** (team) — the SAME options and rule, as a searchable checklist, max 8, "n of 8 selected" always shown.
- **Knowledge base** — a select led by "No knowledge base"; hint by state: "Optional — scope this thread to a knowledge base." / "You have no knowledge bases yet — …" / "Could not load your knowledge bases. …".
- Footer **Cancel / Create thread**. Success toast `Thread “{name}” created.`; failure shows the server's message, else "Could not save that thread."
Shared: `PickerField` options can be `disabled`, and it takes `searchPlaceholder`; `AgentChecklistField` options can be `disabled` with a `hint` line.
