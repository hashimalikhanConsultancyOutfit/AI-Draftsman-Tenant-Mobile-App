# Team module — spec

Phase 14 (second half). Ported from web's `src/features/Team/` and the
gateway's `apps/gateway-b2b/src/app/team/team.controller.ts`, confirmed
against that source on 2026-09-04.

## Scope

One resource, no separate "pending invites" collection: `GET /team`
returns every member row — active and invited alike — in one array,
distinguished only by `status` (`ACTIVE` / `INVITED` / `SUSPENDED`). An
invited person is a real user with a real role and a real membership from
the moment they're invited, not a separate draft object.

## Screens

- `TeamScreen` — registry. Client-side search + a role filter
  (`StatusTabs`, options built from `GET /team/roles` plus "All roles")
  + a status filter (`STATUS_TABS`: All / Active / Pending). No
  pagination — `GET /team` is bounded by headcount, not a list needing
  pages. "Invite member" entry point gated on `team.invite`.
- `InviteMemberFormScreen` — modal. Name (optional), email, role (picker,
  built from `toAssignableRoles(roles)` — owner excluded structurally,
  not just validated against). A pre-submit `checkTeamEmail` courtesy
  check surfaces "already a member" before the real POST; if the check
  itself fails for any reason it's swallowed and the form falls through
  to the real submit, so a flaky check-email call never blocks a valid
  invite. On success opens `InviteLinkModal` with the fresh invite's
  email/link/expiry/emailSent.
- `ChangeRoleFormScreen` — modal, route params seeded directly from the
  row that opened it (`id`, `name`, `email`, `roleName`) — no extra
  `GET /team/:id` fetch. Defense-in-depth: if the target's current role
  is Owner, renders an `EmptyState` with `OWNER_ROLE_LOCKED_MESSAGE`
  instead of a form — ownership is transferred, never edited from this
  list. Submitting the same role as a no-op just goes back without
  hitting the API.
- `InviteLinkModal` — shared by the invite flow and the registry's
  Resend/Copy-link row actions. Unlike `SecretRevealModal`, this one is
  freely dismissible (backdrop tap and hardware back both close it),
  because an invite link can always be re-minted via
  `GET /team/:id/invite-link` — nothing is lost by closing it.

## The last-Owner guard

`teamRules.ts` exports a pure client-side mirror (`countOwners`,
`isLastOwner`) used only to pre-disable the Remove/Withdraw button and
show an explanatory caption under it. The real guarantee lives entirely
server-side, inside the same DB transaction as the remove/role-change
write, closing a TOCTOU race between two concurrent demotions or removals
that a client-side check alone could never close. Owner is also excluded
structurally from every role-assignment picker (`toAssignableRoles`)
rather than merely rejected after the fact — matching web, where
ownership transfer is a separate, deliberately unbuilt flow on both
platforms today.

## Deliberate, disclosed deviations

- **Default role heuristic on invite is an approximation, not a port.**
  Web computes `defaultRoleLabel` from a privilege ranking the client
  doesn't have on mobile. This form instead defaults to a role literally
  named `member` if one exists among the assignable roles, else falls
  back to the last role in that list. Any tenant that renamed or removed
  a role called `member` gets a slightly different default pre-selected
  — never a wrong result, since the field is still a normal required
  picker the user can change before submitting.

## Permission slugs

`team.view` / `team.invite` / `team.assign_role` / `team.remove` — all
four were already present in `src/permissions/slugs.ts` before this
module was built.

## Definition of Done

- [x] Every web route/tab/sub-view has a mobile destination
- [x] List: search + role filter + status filter + pull-to-refresh +
      empty/loading/error (no pagination — matches the real endpoint)
- [x] Every form field, server validation bounds mirrored exactly
- [x] Every action incl. remove/withdraw confirmations and their cancel
      path, with the last-Owner guard's disabled-reason captions
- [x] Every status rendered with correct label + tone (Active / Invited /
      Suspended)
- [x] Every permission gate applied
- [x] Documented error codes handled via `getErrorMessage`
- [x] Success behaviour: toast text, navigation, cache invalidation
- [x] `tsc --noEmit` clean, `expo export` clean
- [ ] Tested on a real device as owner, member, and one custom role
- [ ] Dark mode pass
