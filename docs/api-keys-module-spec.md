# API keys module — spec

Phase 14 (first half). Ported from web's `src/features/ApiKeys/` and the
gateway's `apps/gateway-b2b/src/app/api-keys/` controllers/DTOs, confirmed
against that source on 2026-09-03.

## Scope

Two resources sharing one module: **API keys** (`key.*`) and **key
policies** (`key_policy.*`). A key carries only a name and a policy id —
every limit (spend cap, rate limits, IP allow-list, model/agent scope,
training flag) lives on the policy, shared by every key attached to it.

## Screens

- `ApiKeysScreen` — registry. Search + status tabs (`Active & rotating` /
  `Active` / `Rotating` / `Revoked` / `All`), no pagination (`GET /keys`
  returns every row the tenant owns, filtered server-side). Rotation
  banner when any key has an open rotation window and the session can
  rotate. "New key" and "Manage policies" entry points.
- `ApiKeyFormScreen` — create/edit, modal. Name + policy only. Create
  always sends `environment: 'LIVE'` explicitly (the API itself still
  defaults an omitted value to `SANDBOX`). On create success, opens
  `SecretRevealModal` before closing.
- `KeyUsageScreen` — one key's usage: cap vs spend, a daily bar chart
  (hand-built — this app has no charting library, same as Dashboard's own
  spend series), model split, the 50 most recent requests including
  rejections.
- `RotatingKeysScreen` — every key with an open rotation window, live
  countdown, both prefixes, shared rate limits and remaining budget.
  Reached from the registry's rotation banner.
- `PoliciesScreen` — policy registry. Search + scope tabs + training tabs.
- `PolicyFormScreen` — create/edit, modal. Scope, spend cap (entered in
  pounds, sent as integer pence), reset cadence, rpm/tpm, IP allow-list
  (comma-separated CIDR text), training flag, default flag.
- `PolicyViewScreen` — read-only, reachable on `key_policy.view` alone
  (no manage grant required) — full IP/model/agent lists, created/updated
  timestamps.

## The once-only secret

`SecretRevealModal` is the one place a key's plaintext secret ever
appears — returned once, in the response body of create or rotate, never
persisted anywhere (not the RTK Query cache, not storage). Matches web's
`SecretDialog.tsx` behaviour exactly:

- The Android hardware back button (`onRequestClose`) and any backdrop
  tap are both inert — the only way out is a footer button. Every other
  modal in this app closes on both; this one deliberately doesn't.
- Copy uses `expo-clipboard`; on failure the secret is still selectable
  (`selectable` text) as a manual fallback, with a toast explaining why.
- Both footer buttons ("Copy" and "I have copied it" / "Done" once a copy
  succeeds) dismiss unconditionally — there is no hard "I've saved it"
  gate on either platform. The label change is a nudge, not enforcement.
- A rotation reveal additionally shows the fixed one-hour deadline
  (absolute local time, never relative — "a deadline read wrong is an
  outage") and both masked prefixes.

## Deliberate, disclosed deviations

- **IP allow-list validation is a lighter check than the server's.** The
  backend's `@IsCidr` decorator is a real CIDR parser accepting IPv4 and
  IPv6. The mobile form validates only an IPv4 shape
  (`\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(/\d{1,2})?`) before submit — enough
  to catch an obvious typo, not a full parser. The server remains the
  real authority; a rejected range still surfaces via its error message
  through the existing `getErrorMessage` path. Worth a proper CIDR/IPv6
  parser as a follow-up if this proves to matter in practice.
- **No editor for `allowedAgentIds` / `allowedModelIds`.** This is parity,
  not a gap: web's own `POLICY_FIELDS` has no field for either — they can
  only be set through a call neither platform's UI exposes. `PolicyView`
  still lists them (read-only), ported from `PolicyViewModal.tsx`.
- **Backend permission-enforcement gap, not a mobile decision.**
  `ApiKeysController` / `KeyPoliciesController` are guarded only by
  `JwtAuthGuard` — no `@RequiresPermission()` — unlike every comparable
  controller in this codebase. Enforcement for this module is
  client-side only today (same as web). Tenant isolation itself is not
  affected. Flagged for the backend team; the mobile port gates its
  buttons exactly as if the server enforced them, since that's the only
  thing currently standing in the way, same as web.

## Permission slugs

`key.view` / `key.create` / `key.update` / `key.rotate` / `key.revoke`;
`key_policy.view` / `key_policy.manage` / `key_policy.delete`;
`usage.view` gates every money figure (spend, cap, request cost) on both
resources — one slug for all three, deliberately.

## Definition of Done

- [x] Every web route/tab/sub-view has a mobile destination
- [x] List: search + every filter (status/scope/training) + pull-to-refresh
      + empty/loading/error (no pagination — matches the real endpoints)
- [x] Every form field, server validation bounds mirrored exactly
- [x] Every action incl. rotate/revoke confirmations and their cancel path
- [x] Every status/outcome rendered with correct label + tone
- [x] Every permission gate applied
- [x] Documented error codes handled via `getErrorMessage` (404/409/403)
- [x] Success behaviour: toast text, navigation, cache invalidation
- [x] `tsc --noEmit` clean, `expo export` clean
- [ ] Tested on a real device as owner, member, and one custom role
- [ ] Dark mode pass
