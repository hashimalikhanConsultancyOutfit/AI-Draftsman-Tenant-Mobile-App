# Support module — spec

Phase 15 of the 17-module build plan. Ported from web's
`src/features/Support/` and the gateway's
`apps/gateway-b2b/src/app/support/*`, both read in full and confirmed
against source on 2026-09-04. Unlike Branding & Domain, every route this
module needs is real end-to-end — no mock-only trap here.

## Scope

Everything web's Support route does, re-flowed for a phone: the inbox
(four stat tiles, state filter, search, a paged ticket list), a ticket
detail screen (thread, attachments, escalation record, SLA facts), raise/
edit/reply/note forms, escalate/bring-back/delete actions, the auto-reply
draft banner with its Stop control, and the SLA policy settings screen
for a full-access session. `support.view` gates the whole module, exactly
as it gates web's route.

## Screens

- `SupportScreen` (inbox) — `SummaryTiles` (open/breaching-SLA/escalated/
  median-first-response, reusing the shared `StatTile` — see
  **Deviations**), a state-filter pill row (`StatusTabs`), a 350ms-
  debounced server-side search on customer/subject/owner (the route's own
  limit), and a growing "Load more" list at the server's 10-per-page
  default — the same paging shape `CustomersScreen` already established,
  in place of web's numbered `TablePager`. Polls every 30s
  (`pollingInterval`, not a manual timer) plus pull-to-refresh. "Raise
  ticket" (`support.create`) and "SLA policy" (full access) are hidden,
  not disabled, when ungated — this app's default convention.
- `TicketDetailScreen` — pushed as a full screen rather than web's
  overlay drawer, this app's standing convention for "opens the one thing
  a list row represents" (Customer detail, Role edit). Polls the ticket
  and its draft every 20s. Fires `markSupportTicketViewed` once on mount,
  fire-and-forget (idempotent, `support.view`-gated server-side). Folded
  `CollapsibleSection`s for Details/Service level/(conditionally) what
  was sent to the platform team/Attachments, with the thread below them —
  folded because those sections are REFERENCE material, while the thread
  is why the screen was opened. Actions: Reply, Add note, Edit, Escalate
  (an `EscalateSheet` bottom sheet carrying the exact web privacy notice
  and reason field, not a full screen — the only place in this module
  needing free text alongside a confirm/cancel pair), Bring back (a
  one-tap `Alert.alert` confirm — see **Deviations**), Delete. Each is
  gated on BOTH the atomic permission and the row's own resolved `can`
  flag, matching web's per-ticket authorization model exactly.
- `RaiseTicketFormScreen` — customer (required; see **Deviations**),
  subject, detail, up to 5 attachments (PDF/CSV/XLS/XLSX/PNG, ≤10MB
  each, via `expo-document-picker`), assign to, priority, and an
  "Escalate to AiDraftsman" switch that creates and escalates in one
  multipart `POST /support/tickets`.
- `EditTicketFormScreen` — subject, owner, priority, and a State field
  whose options are `[current state, ...NEXT_STATES[current]]` plus,
  conditionally, "with AiDraftsman" — picking that one routes to
  `escalateSupportTicket` instead of a PATCH, never sent as a plain state
  value (`WITH_PLATFORM` is a 400 on `PATCH /support/tickets/:id` by
  design — see `UpdateTicketDto`). Diffs against the loaded ticket so an
  unchanged form sends nothing and shows "Nothing to save."
- `ReplyFormScreen` — body and up to 5 attachments, either being enough.
  No state control at all — a reply never sends `setState` (see
  `ReplyToSupportTicketRequest`'s doc comment): an OPEN ticket is
  answered server-side, and any other state — including WITH_PLATFORM —
  is left exactly as it was.
- `NoteFormScreen` — one required field, no attachment picker (evidence
  belongs on the ticket's own attachment list; only a message carries a
  visibility flag, an attachment row does not).
- `SlaPolicyFormScreen` — every `UpdateSlaPolicyDto`/`BusinessHoursDto`
  field, default and hint carried over verbatim, including the auto-reply
  warning copy in full ("your support agent writes a reply and it is
  EMAILED to the customer with nobody in the loop"). A PUT, always
  sending the whole shape; `useBusinessHours`/`useAutoReply` are UI-only
  booleans collapsed to `null` fields at submit, never sent themselves.
  Reachable only for a full-access session (see **Permissions**).

## Deviations from web (disclosed, not silent)

- **Ticket detail is a pushed screen, not an overlay drawer** — this
  app's list-row convention throughout, not specific to Support.
- **"On behalf of" is required**, matching web's own already-decided
  narrowing (the `:internal` sentinel was removed from web's select for
  the reasons `Support.data.ts` documents at length); this build follows
  that decision rather than reopening it.
- **Customer and member pickers are bounded fetches** (`limit: 100`),
  the same "a workspace this size fits in one page" reasoning already
  applied to Roles and Team. `PickerField`'s built-in search narrows what
  IS loaded; a tenant with more than 100 customers will not see the rest
  here yet.
- **No purple tone.** Web's `TICKET_STATE_VARIANT`/`MESSAGE_KIND_VARIANT`
  use a `'purple'` chip for WITH_PLATFORM/PLATFORM_REPLY that this app's
  theme does not define (it ships exactly five status pairs). Both map
  to `'info'` — never ambiguous in practice, since the chip always
  carries its own text label next to the colour.
- **The Edit State field omits, rather than disables, "with
  AiDraftsman"** when the viewer lacks `support.escalate`. Web shows it
  disabled with a caption; this app's `PickerField` has no per-option
  disabled state, so the option is left out entirely — consistent with
  this app's general hide-when-ungated convention (Team's "Invite
  member", Roles' "Add role").
- **"Bring back" is a one-tap `Alert.alert` confirm**, not a form screen —
  it carries no field (`updateTicket({state: 'OPEN'})`, exactly web's own
  `handleConfirmReturn`), so a native two-button alert with the same
  confirm copy is a faithful, lighter-weight equivalent to a dialog.
- **Attachment download opens the system handler via `Linking.openURL`**
  rather than web's anchor-click download — this app has no
  `expo-sharing`/`expo-file-system` dependency yet; the signed URL (still
  minted fresh via a mutation, never cached — see `supportApi.ts`) opens
  in whatever the OS resolves for that file type. Worth revisiting with a
  proper in-app viewer/share-sheet if this proves too coarse in practice.
- **`sendEmail` is not exposed.** The DTO field exists and this build
  never sends it, matching web exactly — no control has been designed
  for it on either platform (see `ReplyToSupportTicketRequest`'s doc
  comment); this is a build-or-omit decision inherited as-is, not a gap
  introduced here.
- **`StatTile` is reused from `dashboard/components/`** for the four
  summary tiles rather than a Support-local component — the same
  reuse-over-promotion call already made for Organization Settings.

## Permissions

`SUPPORT_PERMISSIONS`: `VIEW`, `CREATE`, `UPDATE`, `REPLY`, `ESCALATE`,
`DELETE` — gate the module's own screens/actions exactly as they gate
web's. Every per-ticket action is ALSO gated on that ticket's own
server-resolved `can.{update,reply,escalate,delete}`, since a role's
grant can be overridden per-row (mirroring web's authorization model,
not narrower than it). Draft-cancel and mark-viewed are deliberately
`support.view`-gated only — see `supportApi.ts`'s doc comments for why
in each case. `support.sla.manage` does not exist in this app's
`SUPPORT_PERMISSIONS` catalogue (today only a bare `*` full-access role
holds it) — `SlaPolicyFormScreen` and its entry point are gated with
`useHasFullAccess()` instead of a dedicated slug.

## Definition of done

- [x] `support.types.ts` mirrors `support.dto.ts` and web's own
      `support.types.ts` exactly (both read in full).
- [x] `supportRules.ts` — every state/priority/SLA label, tone, toast and
      confirmation copy ported, with the one tone gap disclosed above.
- [x] `supportApi.ts` — all 17 gateway routes, multipart where the DTO is
      multipart, the attachment-URL mint as an uncached mutation.
- [x] Yup schemas mirror `support.dto.ts`'s validators (`SUBJECT_MAX`,
      `BODY_MAX`, `atRiskPct` 1–99, `autoReplyHoldMins` 0–1440, etc.).
- [x] Every screen built: inbox, detail, raise, edit, reply, note, SLA
      policy.
- [x] Navigation: `SupportStack`, `SupportStackParamList`, `AppDrawer`
      swapped from the placeholder screen to the stack.
- [x] `tsc --noEmit` clean.
- [x] `expo export --platform ios` clean (1659 modules).
- [x] This spec.
