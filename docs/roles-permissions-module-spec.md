# Roles & Permissions module — spec

Phase 14 (final piece). Ported from web's `src/features/Roles/`,
`src/store/api/{roles.api.ts,roles.body.ts,permissionCatalogue.ts}` and the
gateway's `apps/gateway-b2b/src/app/roles/{roles.controller.ts,dto/*}` plus
`apps/b2b-core/src/app/role/role.service.ts`, confirmed against that source
on 2026-09-04.

## Scope

Two resources: the workspace's roles (`/roles`) and the global permission
catalogue (`/permissions`, not nested under `/roles` — the catalogue is not
a property of any role, and is fetched live rather than from mobile's own
bundled `permissions/catalogue.ts` reference copy, precisely so this
screen never offers a checkbox the deployed backend would refuse, or hides
one it allows). `permissions`/`fullAccess` never disagree server-side:
`fullAccess === permissions.includes('*')`, and `permissionCount` is `1`
for a full-access role — the UI always reads `fullAccess`, never infers
"everything" from the count.

## Screens

- `RolesScreen` — registry. Client-side search over name + description,
  no pagination (`GET /roles?limit=100` — bounded by catalogue size, not a
  list needing pages, same reasoning as Team and API Keys). "Add role"
  gated on `role.create` + `permission.view` (the picker needs the
  catalogue too). Each row's Edit/Delete are gated per-row by
  `canEditRoleRow`/`canDeleteRoleRow`, not by the raw grants alone.
- `RoleFormScreen` — modal, create + edit. Name, description, a Full
  Access switch, then the permission tree. Full Access and the tree are
  mutually exclusive — the tree disables while it's on, matching web.
  Editing a system role shows `SYSTEM_ROLE_EDIT_NOTE` (or
  `OWNER_PERMISSIONS_LOCKED_NOTE` for the Owner row); a role holding
  legacy/wildcard tokens the catalogue no longer offers shows
  `buildDroppedPermissionsNote` before the tree, since saving replaces the
  whole set and those tokens have no checkbox to preserve them.

## The Owner / system-role lock matrix

Three independent facts, never conflated: `isSystem` is a property of the
ROW, `canUpdate`/`canDelete` are the CALLER's own grants, `viewerIsOwner`
is WHO IS ASKING (never derived from the row).

```
canEditRoleRow   = canUpdate && (!isSystem || viewerIsOwner)   // Owner-exempted
canDeleteRoleRow = canDelete && !isSystem                       // never exempted
```

Delete is refused for every system role, Owner included, no matter who
asks — deliberately asymmetric with edit. Within an editable system role,
`roleEditLocks` narrows further:

```
custom                              -> name, description, permissions
admin | builder | finance | member  -> description, permissions (name fixed)
owner                                -> description only (permissions fixed too)
```

Confirmed directly against `role.service.ts`: a system-role rename is
refused (409) only if the submitted name, once normalised
(lower-cased + whitespace-collapsed, same as storage), differs from the
stored name — resending the same name is a safe no-op, and the form
always submits the display-cased name back, since the server normalises
both sides before comparing. The Owner row's `*` similarly only refuses a
write that drops it — resending `['*']` unchanged passes. This is why the
form always submits the whole role (name + description + permissions) on
every save rather than specially omitting locked fields: a locked field's
UI value is always its original hydrated value anyway.

## Session staleness after a permission change

A role's permission change only reaches a LIVE session the next time that
session's claim is re-minted, via `GET /auth/session` — it doesn't
re-resolve per request. Web hit this exact bug (a saved change did nothing
until a full reload) and fixed it by forcing a session refetch after every
role update; mirrored in `rolesApi.ts`'s `updateRole.onQueryStarted`,
which dispatches `authApi.endpoints.getSession.initiate(..., { forceRefetch:
true })` on success. This only repairs the session running IN THIS APP —
a different signed-in device repairs on its own next cold start, same as
the existing one-bootstrap-per-launch bound on `getSession`.

## Deliberate, disclosed deviations

- **Permission-picker UX is not a port of web's layout.** Web renders all
  ~25 modules always-open in a 340px scroller. An 89-checkbox flat or
  always-open tree would be an unreasonably long phone scroll, so each
  module (`PermissionModuleGroup`) starts collapsed and expands on tap —
  pre-opened automatically on edit for any module the role already holds
  something in, so nothing relevant starts hidden. The header row (a
  tri-state checkbox + label + `held/total` count + chevron) stays visible
  either way. No shared `Checkbox` primitive exists yet in
  `components/ui`, so the new `CheckboxRow` stays local to
  `features/roles/components/`, per this codebase's promotion convention
  (promoted only once a second feature needs the exact same thing).
- **The row caption replaces web's four hover-tooltip variants.**
  `systemRoleCaption` renders as always-visible text under a locked row
  instead — there's no hover on a phone.

## Permission slugs

`role.view` / `role.create` / `role.update` / `role.delete` /
`permission.view` — all five were already present in
`src/permissions/slugs.ts` (`ROLE_PERMISSIONS`) before this module was
built.

## Definition of Done

- [x] Every web route/view has a mobile destination
- [x] List: search + pull-to-refresh + empty/loading/error (no pagination
      — matches the real endpoint)
- [x] Every form field, server validation bounds mirrored exactly
      (name max 64, description max 200, permissions required unless
      Full Access)
- [x] Full Access / permission-tree mutual exclusion, dropped-permissions
      warning on edit
- [x] Owner / system-role lock matrix applied on both the list (per-row
      actions) and the form (locked fields)
- [x] Delete confirmation with member-count-aware warning copy
- [x] Session refetch after a permission-changing update
- [x] Every permission gate applied (`role.view/create/update/delete`,
      `permission.view`)
- [x] Documented error codes handled via `getErrorMessage` +
      `rolesErrorFallback`
- [x] Success behaviour: toast text, navigation, cache invalidation
      (`Role`, `TeamRole` for the Team role picker, `Session`)
- [x] `tsc --noEmit` clean, `expo export` clean
- [ ] Tested on a real device as owner, admin, and one custom role
- [ ] Dark mode pass
